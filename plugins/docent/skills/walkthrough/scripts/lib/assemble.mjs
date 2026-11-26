import fs from 'node:fs/promises';
import path from 'node:path';
import { ffmpeg, probeDuration } from './util.mjs';

/** Turn one recorded scene into a normalized clip: H.264 video + PCM audio with narration placed at step starts. */
export async function buildClip({ video, timeline, fade, cfg, out }) {
  const D = timeline.duration;
  const { width: W, height: H } = cfg.size;
  const voiced = timeline.steps.filter((s) => s.audio);

  const inputs = ['-i', video, '-f', 'lavfi', '-t', D.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo'];
  for (const s of voiced) inputs.push('-i', s.audio);

  const fades = fade
    ? `,fade=t=in:st=0:d=${cfg.fade},fade=t=out:st=${(D - cfg.fade).toFixed(3)}:d=${cfg.fade}`
    : '';
  const filters = [
    `[0:v]fps=${cfg.fps},scale=${W}:${H}:flags=lanczos:force_original_aspect_ratio=decrease,` +
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=5${fades}[v]`,
    ...voiced.map((s, k) =>
      `[${k + 2}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(s.start * 1000)}:all=1[a${k}]`),
    `[1:a]${voiced.map((_, k) => `[a${k}]`).join('')}amix=inputs=${voiced.length + 1}:duration=first:normalize=0[a]`,
  ];

  await ffmpeg([
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[v]', '-map', '[a]', '-t', D.toFixed(3),
    '-c:v', 'libx264', '-preset', cfg.preset, '-crf', String(cfg.crf), '-pix_fmt', 'yuv420p',
    '-c:a', 'pcm_s16le',
    out,
  ]);
  return probeDuration(out);
}

/** Split narration into caption-sized cues, sharing the line's time by length. */
function cues(text, start, duration) {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  const chunks = [];
  for (const sentence of sentences.map((s) => s.trim()).filter(Boolean)) {
    let line = '';
    for (const word of sentence.split(/\s+/)) {
      if (line && (line + ' ' + word).length > 84) { chunks.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) chunks.push(line);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0) || 1;
  let t = start;
  return chunks.map((text) => {
    const d = (duration * text.length) / total;
    const cue = { start: t, end: t + d, text };
    t += d;
    return cue;
  });
}

const stamp = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

/**
 * Join clips into the final MP4 with captions, chapters and normalized loudness.
 * `scenes`: [{ id, chapter, clip, clipDuration, timeline }]
 */
export async function finalize({ scenes, cfg, work, output, title }) {
  let offset = 0;
  const allCues = [];
  const chapters = [];
  for (const s of scenes) {
    s.offset = offset;
    for (const step of s.timeline.steps) {
      if (step.say) allCues.push(...cues(step.say, offset + step.start, step.audioDuration));
    }
    chapters.push({ start: offset, end: offset + s.clipDuration, title: s.chapter });
    offset += s.clipDuration;
  }

  const list = path.join(work, 'concat.txt');
  await fs.writeFile(list, scenes.map((s) => `file '${s.clip.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const joined = path.join(work, 'joined.mkv');
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);

  const meta = path.join(work, 'chapters.ffmeta');
  const esc = (v) => String(v).replace(/([=;#\\\n])/g, '\\$1');
  await fs.writeFile(meta, [
    ';FFMETADATA1',
    `title=${esc(title ?? 'Walkthrough')}`,
    ...chapters.flatMap((c) => [
      '[CHAPTER]', 'TIMEBASE=1/1000',
      `START=${Math.round(c.start * 1000)}`, `END=${Math.round(c.end * 1000)}`, `title=${esc(c.title)}`,
    ]),
  ].join('\n') + '\n');

  await fs.mkdir(path.dirname(output), { recursive: true });
  const srt = output.replace(/\.[^.]+$/, '') + '.srt';
  const hasCaptions = allCues.length > 0;
  if (hasCaptions) {
    await fs.writeFile(srt, allCues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
  }

  await fs.mkdir(path.dirname(output), { recursive: true });
  await ffmpeg([
    '-i', joined, '-i', meta, ...(hasCaptions ? ['-i', srt] : []),
    '-map', '0:v', '-map', '0:a', ...(hasCaptions ? ['-map', '2:s'] : []),
    '-map_metadata', '1', '-map_chapters', '1',
    '-c:v', 'copy',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000', '-c:a', 'aac', '-b:a', '192k',
    ...(hasCaptions ? ['-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng'] : []),
    '-movflags', '+faststart',
    output,
  ]);
  await fs.rm(joined);
  return { duration: offset, srt: hasCaptions ? srt : null };
}

/** Save one still per step (taken just before the step ends) so the result can be inspected. */
export async function reviewFrames({ scenes, output, dir }) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const frames = [];
  for (const s of scenes) {
    for (const [i, step] of s.timeline.steps.entries()) {
      const at = s.offset + Math.max(step.start, step.end - 0.25);
      const file = path.join(dir, `${s.id}-step${i + 1}.jpg`);
      await ffmpeg(['-ss', at.toFixed(3), '-i', output, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '4', file]);
      frames.push({ file, at, scene: s.id, step: i + 1, say: step.say });
    }
  }
  return frames;
}
