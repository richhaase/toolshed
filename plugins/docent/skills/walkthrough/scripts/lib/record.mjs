import { spawn } from 'node:child_process';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { highlightLines, languageFor, readSource } from './code.mjs';
import { diagramStep } from './diagram.mjs';
import { DEPS, exists, sleep } from './util.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(HERE, '..');
const pageUrl = (name) => pathToFileURL(path.join(SCRIPTS, 'pages', name)).href;

/* ------------------------------------------------------------------ */
/* In-page overlays (serialized into the page, so no outer references) */
/* ------------------------------------------------------------------ */

function installCursor({ accent }) {
  if (window.top !== window) return;
  const init = () => {
    if (document.getElementById('__docent_cursor')) return;
    const c = document.createElement('div');
    c.id = '__docent_cursor';
    c.innerHTML =
      '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 3l14 8.5-6.2 1.4 3.6 6.6-2.6 1.4-3.6-6.7L5 19z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    c.style.cssText =
      'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;display:none;will-change:transform;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))';
    document.documentElement.appendChild(c);
    window.addEventListener('mousemove', (e) => {
      c.style.display = 'block';
      c.style.transform = `translate(${e.clientX - 6}px,${e.clientY - 4}px)`;
    }, true);
    window.addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.style.cssText =
        `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:${accent};z-index:2147483646;pointer-events:none`;
      document.documentElement.appendChild(r);
      r.animate(
        [{ transform: 'scale(.2)', opacity: 0.55 }, { transform: 'scale(1)', opacity: 0 }],
        { duration: 500, easing: 'ease-out' },
      ).onfinish = () => r.remove();
    }, true);
  };
  if (document.documentElement) init();
  else document.addEventListener('DOMContentLoaded', init);
}

/** A small persistent label in the corner, e.g. "Before" / "After". */
function installBadge({ text, accent }) {
  if (window.top !== window) return;
  const init = () => {
    if (document.getElementById('__docent_badge')) return;
    const b = document.createElement('div');
    b.id = '__docent_badge';
    b.textContent = text;
    b.style.cssText =
      `position:fixed;top:14px;right:14px;padding:6px 14px;border-radius:999px;background:rgba(15,23,42,.92);color:#f8fafc;` +
      `border:2px solid ${accent};font:700 13px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em;` +
      'text-transform:uppercase;z-index:2147483644;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.3)';
    document.documentElement.appendChild(b);
  };
  if (document.documentElement) init();
  else document.addEventListener('DOMContentLoaded', init);
}

function showHighlight({ box, pad, ms, accent, dim }) {
  const d = document.createElement('div');
  d.style.cssText =
    `position:fixed;left:${box.x - pad}px;top:${box.y - pad}px;width:${box.width + pad * 2}px;height:${box.height + pad * 2}px;` +
    `border:3px solid ${accent};border-radius:10px;box-sizing:border-box;z-index:2147483645;pointer-events:none;` +
    `box-shadow:0 0 0 6px ${accent}33${dim ? ',0 0 0 9999px rgba(8,10,20,.32)' : ''}`;
  document.documentElement.appendChild(d);
  d.animate([{ opacity: 0, transform: 'scale(1.05)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  setTimeout(() => {
    d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).onfinish = () => d.remove();
  }, ms);
}

function showCallout({ text, ms, accent, position }) {
  const d = document.createElement('div');
  d.textContent = text;
  d.style.cssText =
    `position:fixed;left:50%;${position === 'top' ? 'top' : 'bottom'}:36px;max-width:76vw;padding:12px 22px;border-radius:12px;` +
    `background:rgba(15,23,42,.94);color:#f8fafc;border-left:5px solid ${accent};` +
    'font:600 20px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    'box-shadow:0 12px 32px rgba(0,0,0,.35);z-index:2147483645;pointer-events:none;transform:translateX(-50%)';
  document.documentElement.appendChild(d);
  const dy = position === 'top' ? -12 : 12;
  d.animate(
    [{ opacity: 0, transform: `translate(-50%,${dy}px)` }, { opacity: 1, transform: 'translate(-50%,0)' }],
    { duration: 260, easing: 'ease-out' },
  );
  setTimeout(() => {
    d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260 }).onfinish = () => d.remove();
  }, ms);
}

/* ------------------------------------------------------------------ */
/* `ui` helpers: human-paced, visible interactions for browser scenes   */
/* ------------------------------------------------------------------ */

function makeUi(page, cfg) {
  const accent = cfg.theme.accent;
  let pos = { x: cfg.viewport.width * 0.5, y: cfg.viewport.height * 0.62 };
  const loc = (t) => (typeof t === 'string' ? page.locator(t) : t);

  async function glide(x, y) {
    const dist = Math.hypot(x - pos.x, y - pos.y);
    if (dist < 2) return;
    const ms = Math.min(900, Math.max(260, dist * 0.9));
    const n = Math.max(2, Math.round(ms / 16));
    const from = { ...pos };
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
      await sleep(16);
    }
    pos = { x, y };
  }

  /** Smooth-scroll the target into view if needed and wait for it to stop moving. */
  async function settle(target) {
    const l = loc(target);
    await l.waitFor({ state: 'visible' });
    await l.evaluate((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < 90 || r.bottom > innerHeight - 90) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    let prev = null;
    for (let i = 0; i < 25; i++) {
      const box = await l.boundingBox();
      if (!box) throw new Error('target has no bounding box (is it visible?)');
      if (prev && Math.abs(box.x - prev.x) < 0.5 && Math.abs(box.y - prev.y) < 0.5) return { l, box };
      prev = box;
      await sleep(90);
    }
    return { l, box: prev };
  }

  const ui = {
    /** Glide the pointer to an element (selector or Locator) without clicking. */
    async hover(target) {
      const { l, box } = await settle(target);
      await glide(box.x + box.width / 2, box.y + box.height / 2);
      await l.hover();
    },
    /** Glide to an element, pause briefly, and click it. */
    async click(target, options = {}) {
      const { l, box } = await settle(target);
      await glide(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(140);
      await l.click(options);
      await sleep(180);
    },
    /** Click a field and type into it one key at a time. */
    async type(target, text, { delay = 55, clear = false } = {}) {
      await ui.click(target);
      if (clear) await loc(target).fill('');
      await loc(target).pressSequentially(text, { delay });
      await sleep(200);
    },
    async press(key) {
      await page.keyboard.press(key);
      await sleep(200);
    },
    /** Draw a ring around an element, dimming the rest of the page. */
    async highlight(target, { ms = 1800, pad = 6, dim = true, wait = true } = {}) {
      const { box } = await settle(target);
      await page.evaluate(showHighlight, { box, pad, ms, accent, dim });
      if (wait) await sleep(ms + 240);
    },
    /** Show a short caption banner over the page. Does not block by default. */
    async callout(text, { ms = 2600, position = 'bottom', wait = false } = {}) {
      await page.evaluate(showCallout, { text, ms, accent, position });
      if (wait) await sleep(ms + 280);
    },
    /** Smooth-scroll the page by `dy` pixels (or to an element if given a target). */
    async scroll(dyOrTarget, { ms = 700 } = {}) {
      if (typeof dyOrTarget === 'number') {
        await page.evaluate((top) => window.scrollBy({ top, behavior: 'smooth' }), dyOrTarget);
        await sleep(ms);
      } else {
        await loc(dyOrTarget).evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await sleep(ms);
      }
    },
    pause: (ms) => sleep(ms),
    /** Re-show the pointer after a navigation replaced the document. */
    async _restore() {
      await page.mouse.move(pos.x + 1, pos.y);
      await page.mouse.move(pos.x, pos.y);
    },
  };
  return ui;
}

/* ------------------------------------------------------------------ */
/* Scene drivers: prepare the page, then run one step at a time         */
/* ------------------------------------------------------------------ */

async function browserDriver(page, cfg, scene) {
  await page.addInitScript(installCursor, { accent: cfg.theme.accent });
  if (scene.badge) await page.addInitScript(installBadge, { text: scene.badge, accent: cfg.theme.accent });
  const ui = makeUi(page, cfg);
  page.on('domcontentloaded', () => ui._restore().catch(() => {}));
  const api = { page, ui, context: page.context() };
  if (scene.url) await page.goto(scene.url, { waitUntil: 'load' });
  if (scene.prepare) await scene.prepare(api);
  await ui._restore();
  return { runStep: (step) => step.do?.(api) };
}

async function titleDriver(page, cfg, scene) {
  await page.goto(pageUrl('title.html'));
  await page.evaluate((t) => window.theme(t), cfg.theme);
  const card = {
    kicker: scene.kicker, title: scene.title, subtitle: scene.subtitle,
    bullets: scene.bullets, stagger: scene.stagger,
  };
  return { runStep: () => page.evaluate((d) => window.render(d), card) };
}

function runInPty(command, { cwd, env, cols, rows, timeout }, onData) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [path.join(SCRIPTS, 'pty_run.py'), String(cols), String(rows), command], {
      cwd,
      env: { ...process.env, TERM: 'xterm-256color', COLUMNS: String(cols), LINES: String(rows), ...env },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const decoder = new StringDecoder('utf8');
    let queue = Promise.resolve();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
    child.stdout.on('data', (d) => { const s = decoder.write(d); queue = queue.then(() => onData(s)); });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      queue.then(() => (timedOut ? reject(new Error(`timed out after ${timeout} ms: ${command}`)) : resolve(code)), reject);
    });
  });
}

async function terminalDriver(page, cfg, scene, root) {
  const cwd = path.resolve(root, scene.cwd ?? '.');
  await page.goto(pageUrl('terminal.html'));
  await page.addStyleTag({ path: path.join(DEPS, '@xterm/xterm/css/xterm.css') });
  await page.addScriptTag({ path: path.join(DEPS, '@xterm/xterm/lib/xterm.js') });
  await page.addScriptTag({ path: path.join(DEPS, '@xterm/addon-fit/lib/addon-fit.js') });
  const { cols, rows } = await page.evaluate((o) => window.setup(o), {
    title: scene.title ?? path.basename(cwd),
    fontSize: scene.fontSize ?? 18,
    theme: cfg.theme,
  });
  const prompt = scene.prompt ?? '\x1b[1;32m❯\x1b[0m ';
  let last = '\n';
  const write = async (data) => {
    if (!data) return;
    last = data.at(-1);
    await page.evaluate((d) => window.write(d), data);
  };
  await write(prompt);
  return {
    async runStep(step) {
      if (step.clear) await write('\x1b[2J\x1b[3J\x1b[H' + prompt);
      if (!step.run) return;
      for (const ch of step.show ?? step.run) {
        await write(ch);
        await sleep((step.typeDelay ?? 38) * (0.6 + Math.random() * 0.8));
      }
      await sleep(280);
      await write('\r\n');
      const code = await runInPty(
        step.run,
        { cwd, env: { ...scene.env, ...step.env }, cols, rows, timeout: step.timeout ?? 120_000 },
        write,
      );
      if (code !== 0 && !step.allowFail) {
        throw new Error(`command exited ${code}: ${step.run}\n(set allowFail: true on the step if a failure is the point)`);
      }
      await write((last === '\n' ? '' : '\r\n') + prompt);
    },
  };
}

async function codeDriver(page, cfg, scene) {
  await page.goto(pageUrl('code.html'));
  await page.evaluate((o) => window.setup(o), { fontSize: scene.fontSize ?? 17, theme: cfg.theme });
  const cache = new Map();
  const html = async (file) => {
    if (!cache.has(file)) {
      const abs = path.resolve(scene._base, file);
      cache.set(file, highlightLines(await readSource(abs), languageFor(abs, scene.language)));
    }
    return cache.get(file);
  };
  const open = async (step, animate) =>
    page.evaluate((d) => window.load(d), { path: step._file, lines: await html(step._file), ranges: step._ranges, animate });
  // Start on the first step's file, already scrolled to where that step will point.
  let current = scene.steps[0]._file;
  await open(scene.steps[0], false);
  return {
    async runStep(step) {
      if (step._file !== current) {
        current = step._file;
        await open(step, true);
      }
      await page.evaluate((d) => window.focus(d), { ranges: step._ranges, note: step.note });
    },
  };
}

async function diagramDriver(page, cfg, scene) {
  await page.goto(pageUrl('diagram.html'));
  await page.evaluate((o) => window.setup(o), {
    title: scene.title, nodes: scene.nodes, edges: scene._edges, ranks: scene._ranks,
    direction: scene.direction, reveal: scene._reveal, theme: cfg.theme,
  });
  return { runStep: (step) => page.evaluate((d) => window.step(d), diagramStep(step)) };
}

const DRIVERS = { browser: browserDriver, title: titleDriver, terminal: terminalDriver, code: codeDriver, diagram: diagramDriver };

/* ------------------------------------------------------------------ */
/* Recorder                                                             */
/* ------------------------------------------------------------------ */

/**
 * Record one scene to `videoFile` and return its timeline:
 * { duration, steps: [{ start, end, say, audio, audioDuration }] } (seconds from video start).
 *
 * Each step starts its narration and its action together, then holds until the
 * narration has finished, so picture and voice stay aligned by construction.
 */
export async function recordScene(browser, cfg, scene, { root, videoFile, statePath, failShot }) {
  const useState = scene.type === 'browser' && !scene.freshState && (await exists(statePath));
  const context = await browser.newContext({
    viewport: cfg.viewport,
    deviceScaleFactor: cfg.deviceScaleFactor,
    baseURL: cfg.baseURL,
    colorScheme: cfg.colorScheme,
    storageState: useState ? statePath : undefined,
    ...cfg.contextOptions,
    ...scene.contextOptions,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(cfg.actionTimeout);
  let stepNo = 0;
  try {
    const driver = await DRIVERS[scene.type](page, cfg, scene, root);
    await page.screencast.start({ path: videoFile, size: cfg.size, quality: cfg.quality });
    const t0 = performance.now();
    const now = () => (performance.now() - t0) / 1000;
    await sleep(cfg.lead * 1000);

    const steps = [];
    for (const step of scene.steps) {
      stepNo++;
      const start = now();
      await driver.runStep(step);
      const actionEnd = now();
      const spoken = step.audio ? step.audio.duration + cfg.gap : 0;
      await sleep((start + Math.max(spoken, step.hold ?? 0) - now()) * 1000);
      steps.push({
        start, end: now(), actionEnd,
        say: step.say, audio: step.audio?.file, audioDuration: step.audio?.duration,
      });
    }
    await sleep(cfg.tail * 1000);
    const duration = now();
    await page.screencast.stop();
    if (scene.type === 'browser') await context.storageState({ path: statePath });
    return { duration, steps };
  } catch (err) {
    await page.screenshot({ path: failShot }).catch(() => {});
    err.message = `scene "${scene.id}"${stepNo ? ` step ${stepNo}` : ' (prepare)'}: ${err.message}\n  screenshot at failure: ${failShot}`;
    throw err;
  } finally {
    await context.close();
  }
}
