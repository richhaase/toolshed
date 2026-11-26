import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCENT_HOME, exists, ffmpeg, probeDuration, run, sha } from './util.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Apply the storyboard's `pronounce` map so the voice says what a person would. */
function spoken(text, pronounce = {}) {
  let out = text;
  for (const [from, to] of Object.entries(pronounce)) {
    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(?<![\\w-])${esc}(?![\\w-])`, 'g'), to);
  }
  return out;
}

/**
 * Synthesize every narration line, cached by content hash.
 * Returns Map<text, { file, duration }>.
 */
export async function synthesize(texts, cfg, audioDir) {
  await fs.mkdir(audioDir, { recursive: true });
  const result = new Map();
  const todo = [];
  const unused = Object.keys(cfg.pronounce ?? {}).filter((from) => ![...texts].some((t) => spoken(t, { [from]: '\u0000' }) !== t));
  if (unused.length) console.log(`warning:  pronounce entries that match no narration: ${unused.join(', ')}`);
  for (const text of new Set(texts)) {
    const say = spoken(text, cfg.pronounce);
    const file = path.join(audioDir, `${sha([cfg.engine, cfg.voice, cfg.speed, say].join('|'))}.wav`);
    result.set(text, { file });
    if (!(await exists(file))) todo.push({ text: say, out: file });
  }

  if (todo.length) {
    console.log(`narration: synthesizing ${todo.length} line(s) with ${cfg.engine}`);
    if (cfg.engine === 'kokoro') {
      await run('uv', ['run', '--quiet', '--script', path.join(HERE, '..', 'tts_kokoro.py')], {
        input: JSON.stringify({ voice: cfg.voice, speed: cfg.speed, lang: cfg.lang, items: todo }),
        quiet: false,
        env: { ...process.env, DOCENT_MODEL_DIR: path.join(DOCENT_HOME, 'models') },
      });
    } else if (cfg.engine === 'say') {
      for (const item of todo) {
        const aiff = item.out.replace(/\.wav$/, '.aiff');
        const voice = cfg.sayVoice ? ['-v', cfg.sayVoice] : [];
        await run('say', [...voice, '-r', String(Math.round(175 * cfg.speed)), '-o', aiff, item.text]);
        await ffmpeg(['-i', aiff, item.out]);
        await fs.rm(aiff);
      }
    } else {
      throw new Error(`unknown narration engine "${cfg.engine}" (use "kokoro" or "say")`);
    }
  }

  for (const entry of result.values()) entry.duration = await probeDuration(entry.file);
  return result;
}
