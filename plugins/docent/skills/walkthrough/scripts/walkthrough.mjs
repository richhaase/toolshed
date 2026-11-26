#!/usr/bin/env node
// Build a narrated walkthrough video from a storyboard module.
// Pipeline: narration (TTS) -> record each scene (Playwright) -> clips -> final MP4 (ffmpeg).
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildClip, finalize, reviewFrames } from './lib/assemble.mjs';
import { resolveCodeScene } from './lib/code.mjs';
import { resolveDiagramScene } from './lib/diagram.mjs';
import { synthesize } from './lib/tts.mjs';
import { exists, fmtTime, requireDep, run, sha, slug } from './lib/util.mjs';

const USAGE = `usage: walkthrough.mjs <storyboard.mjs> [options]

  --dry            synthesize narration and print the timed script; record nothing
  --only a,b       re-record only these scenes (id, name, or 1-based number); reuse the rest
  --force          re-record every scene, ignoring the cache
  --engine NAME    narration engine: kokoro (default) or say (fast macOS draft voice)
  --headed         show the browser while recording
`;

const DEFAULTS = {
  output: 'walkthrough.mp4',
  viewport: { width: 1280, height: 720 }, // CSS pixels the app lays out in
  size: { width: 1920, height: 1080 }, // output pixels; must share the viewport's aspect ratio
  fps: 30,
  quality: 95,
  crf: 18,
  preset: 'medium',
  colorScheme: 'light',
  engine: 'kokoro',
  voice: 'af_heart',
  lang: 'en-us',
  speed: 1,
  pronounce: {},
  gap: 0.35, // silence after each narrated step
  lead: 0.4, // still time at the start of each scene
  tail: 0.45, // still time at the end of each scene
  fade: 0.35,
  actionTimeout: 15_000,
  contextOptions: {},
};
const THEME = { accent: '#6366f1', background: '#0b1020', foreground: '#f8fafc', muted: '#94a3b8' };
const SCENE_TYPES = ['title', 'browser', 'terminal', 'code', 'diagram'];
// Fields that make a step do something, and the scene type each belongs to.
const STEP_FIELDS = {
  do: 'browser', run: 'terminal', clear: 'terminal',
  file: 'code', lines: 'code', find: 'code', note: 'code',
  show: 'diagram', focus: 'diagram', flow: 'diagram',
};

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry' || a === '--force' || a === '--headed') args[a.slice(2)] = true;
    else if (a === '--only' || a === '--engine') args[a.slice(2)] = argv[++i];
    else if (a === '-h' || a === '--help') args.help = true;
    else if (a.startsWith('-')) throw new Error(`unknown option ${a}\n\n${USAGE}`);
    else args._.push(a);
  }
  return args;
}

function normalize(sb) {
  if (!sb || !Array.isArray(sb.scenes) || !sb.scenes.length) {
    throw new Error('storyboard must default-export an object with a non-empty `scenes` array');
  }
  const seen = new Set();
  return sb.scenes.map((scene, i) => {
    const where = `scene ${i + 1}`;
    if (!SCENE_TYPES.includes(scene.type)) {
      throw new Error(`${where}: type must be one of ${SCENE_TYPES.join(', ')} (got ${JSON.stringify(scene.type)})`);
    }
    const name = scene.name ?? (scene.type === 'title' ? scene.title : null) ?? scene.type;
    let id = `${String(i + 1).padStart(2, '0')}-${slug(name)}`;
    while (seen.has(id)) id += 'x';
    seen.add(id);

    let steps;
    if (scene.type === 'title') {
      if (!scene.title) throw new Error(`${where}: a title scene needs \`title\``);
      steps = [{ say: scene.say, hold: scene.duration ?? 3 }];
    } else {
      if (!Array.isArray(scene.steps) || !scene.steps.length) throw new Error(`${where}: needs a non-empty \`steps\` array`);
      steps = scene.steps.map((step, j) => {
        const at = `${where} step ${j + 1}`;
        if (step.say != null && typeof step.say !== 'string') throw new Error(`${at}: \`say\` must be a string`);
        for (const [field, type] of Object.entries(STEP_FIELDS)) {
          // `show` is also a terminal step option (the text typed in place of `run`).
          if (step[field] == null || type === scene.type || (field === 'show' && scene.type === 'terminal')) continue;
          throw new Error(`${at}: \`${field}\` belongs in ${type} scenes, not ${scene.type} scenes`);
        }
        if (step.do != null && typeof step.do !== 'function') throw new Error(`${at}: \`do\` must be an async function`);
        if (step.run != null && typeof step.run !== 'string') throw new Error(`${at}: \`run\` must be a shell command string`);
        const acts = Object.keys(STEP_FIELDS).some((f) => step[f] != null && step[f] !== false);
        if (!step.say && !step.hold && !acts) throw new Error(`${at}: step does nothing (add say, an action, or hold)`);
        return { ...step };
      });
    }
    if (scene.cleanup != null && (scene.type !== 'browser' || typeof scene.cleanup !== 'function')) {
      throw new Error(`${where}: \`cleanup\` must be an async function on a browser scene`);
    }
    return { ...scene, id, name, steps, chapter: scene.chapter ?? scene.title ?? name };
  });
}

/**
 * Identify the code being filmed: the commit of the repo at `dir` plus a hash of its uncommitted
 * changes, ignoring Docent's own files. Returns null when `dir` is not in a git repository.
 * Contents of untracked files are not hashed, only their names.
 */
async function sourceState(dir, ignore) {
  try {
    const git = (...a) => run('git', ['-C', dir, ...a]);
    const top = (await git('rev-parse', '--show-toplevel')).trim();
    const head = (await git('rev-parse', 'HEAD')).trim();
    const excludes = ignore
      .map((p) => path.relative(top, p))
      .filter((rel) => rel && !rel.startsWith('..') && !path.isAbsolute(rel))
      .map((rel) => `:(exclude,top,literal)${rel}`);
    const spec = ['--', ':(top)', ...excludes];
    const status = await git('status', '--porcelain', ...spec);
    const dirty = status.trim() ? sha(status + (await git('diff', 'HEAD', ...spec))) : null;
    return `${head.slice(0, 12)}${dirty ? `+${dirty.slice(0, 8)}` : ''}`;
  } catch {
    return null;
  }
}

const fingerprint = (scene, cfg) =>
  sha(JSON.stringify(
    [scene, cfg.source, cfg.viewport, cfg.deviceScaleFactor, cfg.size, cfg.quality, cfg.theme, cfg.colorScheme, cfg.baseURL, cfg.gap, cfg.lead, cfg.tail, cfg.contextOptions],
    (_, v) => (typeof v === 'function' || v instanceof RegExp ? v.toString() : v),
  ));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length !== 1) {
    console.log(USAGE);
    process.exit(args.help ? 0 : 2);
  }

  const sbPath = path.resolve(args._[0]);
  const root = path.dirname(sbPath);
  let sb = (await import(`${pathToFileURL(sbPath).href}?t=${Date.now()}`)).default;
  if (typeof sb === 'function') sb = await sb();
  const scenes = normalize(sb);
  for (const [i, s] of scenes.entries()) {
    if (s.type === 'code') await resolveCodeScene(s, root, `scene ${i + 1}`);
    if (s.type === 'diagram') resolveDiagramScene(s, `scene ${i + 1}`);
  }

  const { scenes: _s, setup, teardown, theme, ...overrides } = sb;
  const cfg = { ...DEFAULTS, ...overrides, theme: { ...THEME, ...theme } };
  if (args.engine) cfg.engine = args.engine;
  // The app is rendered at viewport size and rasterized at size/viewport, so text stays sharp.
  cfg.deviceScaleFactor = cfg.size.width / cfg.viewport.width;
  if (Math.abs(cfg.deviceScaleFactor - cfg.size.height / cfg.viewport.height) > 0.01) {
    throw new Error('`size` and `viewport` must have the same aspect ratio (e.g. viewport 1280x720 with size 1920x1080)');
  }

  await run('ffmpeg', ['-version']).catch(() => {
    throw new Error('ffmpeg is required (macOS: brew install ffmpeg)');
  });

  const work = path.join(root, '.docent');
  await fs.mkdir(path.join(work, 'scenes'), { recursive: true });

  // 1. Narration first: its length sets the pace of every step.
  const texts = scenes.flatMap((s) => s.steps.map((st) => st.say).filter(Boolean));
  const audio = await synthesize(texts, cfg, path.join(work, 'audio'));
  for (const s of scenes) for (const st of s.steps) if (st.say) st.audio = audio.get(st.say);

  if (args.dry) {
    let total = 0;
    for (const s of scenes) {
      console.log(`\n[${s.id}] ${s.type}`);
      for (const [i, st] of s.steps.entries()) {
        const d = st.audio ? st.audio.duration + cfg.gap : st.hold ?? 0;
        total += d;
        console.log(`  ${i + 1}. ${st.audio ? `${st.audio.duration.toFixed(1)}s  ${st.say}` : `(no narration${st.run ? `: $ ${st.run}` : ''})`}`);
      }
      total += cfg.lead + cfg.tail;
    }
    console.log(`\nestimated length: at least ${fmtTime(total)} (actions that outlast their narration add to this)`);
    if (total > 120) console.log('warning:  over the two-minute target; cut scope or trim narration before recording');
    return;
  }

  // 2. Decide what to record. The cache key includes the filmed repo's commit and uncommitted
  //    changes, so footage of an older code state is never silently reused.
  const output = path.resolve(root, cfg.output);
  const repoDir = path.resolve(root, cfg.repo ?? '.');
  const ours = [sbPath, work, output, output.replace(/\.[^.]+$/, '') + '.srt'];
  cfg.source = await sourceState(repoDir, ours);
  console.log(cfg.source ? `source:   ${repoDir} @ ${cfg.source}` : `source:   ${repoDir} is not a git repository; code changes will not invalidate cached scenes`);
  const only = args.only?.split(',').map((x) => x.trim()).filter(Boolean);
  const picked = (s, i) => only?.some((o) => o === s.id || o === s.name || o === String(i + 1) || s.id.slice(3) === o);
  if (only) {
    const unknown = only.filter((o) => !scenes.some((s, i) => o === s.id || o === s.name || o === String(i + 1) || s.id.slice(3) === o));
    if (unknown.length) throw new Error(`--only: no scene matches ${unknown.join(', ')} (scenes: ${scenes.map((s) => s.id).join(', ')})`);
  }
  const stale = [];
  for (const [i, s] of scenes.entries()) {
    s.dir = path.join(work, 'scenes', s.id);
    s.video = path.join(s.dir, 'video.webm');
    s.clip = path.join(s.dir, 'clip.mkv');
    s.key = fingerprint(s, cfg);
    const saved = await fs.readFile(path.join(s.dir, 'timeline.json'), 'utf8').then(JSON.parse, () => null);
    const cached = saved && (await exists(s.video)) && (await exists(s.clip));
    if (only) {
      s.record = picked(s, i);
      if (!s.record && !cached) throw new Error(`--only: scene ${s.id} has never been recorded; run without --only first`);
    } else {
      s.record = args.force || !cached || saved.key !== s.key;
    }
    if (!s.record) {
      Object.assign(s, { timeline: saved.timeline, clipDuration: saved.clipDuration });
      if ((saved.source ?? null) !== cfg.source) stale.push(s.id);
    }
  }

  // 3. Record.
  const toRecord = scenes.filter((s) => s.record);
  if (toRecord.length) {
    const { chromium } = requireDep('playwright');
    const browser = await chromium.launch({
      headless: !args.headed,
      args: [`--force-device-scale-factor=${cfg.deviceScaleFactor}`],
    });
    // setup/teardown get `openPage()`: an unrecorded page sharing the scenes' cookies and storage.
    const statePath = path.join(work, 'state.json');
    const hook = async (fn) => {
      const contexts = [];
      const openPage = async () => {
        const context = await browser.newContext({
          viewport: cfg.viewport, baseURL: cfg.baseURL, colorScheme: cfg.colorScheme,
          storageState: (await exists(statePath)) ? statePath : undefined,
          ...cfg.contextOptions,
        });
        contexts.push(context);
        return context.newPage();
      };
      try {
        await fn({ openPage });
      } finally {
        for (const context of contexts) {
          await context.storageState({ path: statePath }).catch(() => {});
          await context.close();
        }
      }
    };
    try {
      if (setup) await hook(setup);
      for (const s of toRecord) {
        process.stdout.write(`recording ${s.id} ... `);
        await fs.rm(s.dir, { recursive: true, force: true });
        await fs.mkdir(s.dir, { recursive: true });
        s.timeline = await recordScene_(browser, cfg, s, root, work);
        console.log(fmtTime(s.timeline.duration));
        s.clipDuration = await buildClip({
          video: s.video, timeline: s.timeline, cfg, out: s.clip,
          fade: s.fade ?? s.type === 'title',
        });
        await fs.writeFile(
          path.join(s.dir, 'timeline.json'),
          JSON.stringify({ key: s.key, source: cfg.source, clipDuration: s.clipDuration, timeline: s.timeline }, null, 2),
        );
      }
    } finally {
      try {
        if (teardown) await hook(teardown);
      } finally {
        await browser.close();
      }
    }
  }
  const reused = scenes.length - toRecord.length;
  if (reused) console.log(`reused ${reused} cached scene(s); pass --force to re-record everything`);

  // 4. Assemble.
  const { duration, srt } = await finalize({ scenes, cfg, work, output, title: sb.title });
  const { frames, sheets } = await reviewFrames({ scenes, output, dir: path.join(work, 'review') });

  // 5. Report, including pacing problems worth fixing.
  const warnings = [];
  if (stale.length) {
    warnings.push(`reused footage recorded from different code (${stale.join(', ')}); re-record those scenes or rebuild with --force`);
  }
  const sourceNow = await sourceState(repoDir, ours);
  if (toRecord.length && sourceNow !== cfg.source) {
    warnings.push(`the filmed repo changed during this build (${cfg.source} -> ${sourceNow}); scenes may show different code states. Check the branch, then rebuild with --force`);
  }
  for (const s of scenes) {
    for (const [i, st] of s.timeline.steps.entries()) {
      const silent = st.end - st.start - (st.audioDuration ?? 0);
      if (silent > 4) warnings.push(`${s.id} step ${i + 1}: ${silent.toFixed(1)}s without narration (trim the action, add a line, or split the step)`);
    }
  }
  console.log(`\nvideo:    ${output}  (${fmtTime(duration)}, ${cfg.size.width}x${cfg.size.height})`);
  if (srt) console.log(`captions: ${srt}  (also embedded as a subtitle track)`);
  console.log(`review:   ${path.join(work, 'review')}  (${frames.length} stills: one per step, plus one per highlight or callout)`);
  console.log(`          start with the contact sheet${sheets.length > 1 ? 's' : ''}: ${sheets.map((f) => path.basename(f)).join(', ')}`);
  for (const w of warnings) console.log(`warning:  ${w}`);
}

async function recordScene_(browser, cfg, scene, root, work) {
  const { recordScene } = await import('./lib/record.mjs');
  return recordScene(browser, cfg, scene, {
    root,
    videoFile: scene.video,
    statePath: path.join(work, 'state.json'),
    failShot: path.join(work, `failure-${scene.id}.png`),
  });
}

main().catch((err) => {
  console.error(`\nerror: ${err.message}`);
  process.exit(1);
});
