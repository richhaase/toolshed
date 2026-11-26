import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

/** Where Docent keeps what must outlive a plugin update: Node dependencies and voice models. */
export const DOCENT_HOME = process.env.DOCENT_HOME || path.join(os.homedir(), '.cache', 'docent');
export const DEPS = path.join(DOCENT_HOME, 'node', 'node_modules');

/** Load a dependency installed by setup.sh (kept outside the plugin folder). */
export function requireDep(name) {
  try {
    return createRequire(path.join(DEPS, '..', 'package.json'))(name);
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
    throw new Error(`"${name}" is not installed. Run the setup script first: bash ${path.join(import.meta.dirname, '..', 'setup.sh')}`);
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

export const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

export const exists = (p) => fs.access(p).then(() => true, () => false);

export const slug = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'scene';

/** Run a command; resolve with stdout, reject with the tail of stderr. */
export function run(cmd, args, { input, cwd, env, quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ['pipe', 'pipe', quiet ? 'pipe' : 'inherit'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (err = (err + d).slice(-4000)));
    child.on('error', (e) =>
      reject(new Error(e.code === 'ENOENT' ? `${cmd} is not installed or not on PATH` : e.message)));
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}\n${err.trim()}`)));
    child.stdin.end(input ?? '');
  });
}

export const ffmpeg = (args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

export async function probeDuration(file) {
  const out = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
  ]);
  const d = parseFloat(out);
  if (!Number.isFinite(d)) throw new Error(`could not read duration of ${file}`);
  return d;
}

export const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
};
