// Code scenes: resolve which lines each step points at, and turn source into highlighted lines.
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireDep, sha } from './util.mjs';

const BY_EXT = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', scala: 'scala', swift: 'swift',
  c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php', lua: 'lua', pl: 'perl', r: 'r',
  ex: 'elixir', exs: 'elixir', erl: 'erlang', hs: 'haskell', clj: 'clojure', dart: 'dart', groovy: 'groovy',
  gradle: 'groovy', sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell', yml: 'yaml', yaml: 'yaml',
  json: 'json', toml: 'ini', ini: 'ini', cfg: 'ini', md: 'markdown', html: 'xml', xml: 'xml', css: 'css',
  scss: 'scss', graphql: 'graphql', proto: 'protobuf', tf: 'ini', diff: 'diff', patch: 'diff',
};
const BY_NAME = { dockerfile: 'dockerfile', makefile: 'makefile', gemfile: 'ruby', rakefile: 'ruby' };

export function languageFor(file, override) {
  if (override) return override;
  const base = path.basename(file).toLowerCase();
  return BY_NAME[base] ?? BY_EXT[base.split('.').pop()] ?? null;
}

export async function readSource(abs) {
  const text = (await fs.readFile(abs, 'utf8')).replace(/\r\n/g, '\n').replace(/\n$/, '');
  return text.split('\n');
}

/** `lines` may be 12, [12, 20], or a list of those. Returns [[from, to], ...], 1-based inclusive. */
function toRanges(lines, at) {
  const one = (r) => {
    const [a, b] = Array.isArray(r) ? r : [r, r];
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a) {
      throw new Error(`${at}: \`lines\` must be a line number, [from, to], or a list of those (got ${JSON.stringify(lines)})`);
    }
    return [a, b];
  };
  if (Array.isArray(lines) && lines.length === 2 && lines.every(Number.isInteger)) return [one(lines)];
  return Array.isArray(lines) ? lines.map(one) : [one(lines)];
}

/**
 * Work out, for every step of a code scene, the file on screen and the line ranges to highlight.
 * Fails early when a file is missing, a range runs past the end, or `find` matches nothing,
 * so a storyboard cannot silently point at the wrong code after the source moves.
 */
export async function resolveCodeScene(scene, root, where) {
  const base = path.resolve(root, scene.cwd ?? '.');
  const sources = new Map();
  const hashes = {};
  const load = async (file, at) => {
    if (!sources.has(file)) {
      const abs = path.resolve(base, file);
      const lines = await readSource(abs).catch((err) => {
        throw new Error(`${at}: cannot read ${abs} (${err.code ?? err.message})`);
      });
      sources.set(file, lines);
      hashes[file] = sha(lines.join('\n'));
    }
    return sources.get(file);
  };

  let file = scene.file;
  for (const [j, step] of scene.steps.entries()) {
    const at = `${where} step ${j + 1}`;
    file = step.file ?? file;
    if (!file) throw new Error(`${at}: no file to show (set \`file\` on the scene or the step)`);
    const src = await load(file, at);
    let ranges = [];
    if (step.find != null) {
      if (step.lines != null) throw new Error(`${at}: use \`lines\` or \`find\`, not both`);
      const hit = (l) => (step.find instanceof RegExp ? step.find.test(l) : l.includes(step.find));
      const i = src.findIndex((l) => { if (step.find instanceof RegExp) step.find.lastIndex = 0; return hit(l); });
      if (i < 0) throw new Error(`${at}: \`find\` ${String(step.find)} matches no line in ${file}`);
      const span = step.span ?? 1;
      if (!Number.isInteger(span) || span < 1) throw new Error(`${at}: \`span\` must be a positive whole number of lines`);
      ranges = [[i + 1, Math.min(src.length, i + span)]];
    } else if (step.lines != null) {
      ranges = toRanges(step.lines, at);
      const past = ranges.find(([, b]) => b > src.length);
      if (past) throw new Error(`${at}: lines ${past.join('-')} run past the end of ${file} (${src.length} lines)`);
    }
    step._file = file;
    step._ranges = ranges;
  }
  scene._base = base;
  scene._hashes = hashes; // part of the scene's cache key, so edited source re-records the scene
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Highlight source and return one HTML string per line, with spans closed and reopened at line breaks. */
export function highlightLines(lines, language) {
  const hljs = requireDep('highlight.js');
  const text = lines.join('\n');
  const html = language && hljs.getLanguage(language)
    ? hljs.highlight(text, { language, ignoreIllegals: true }).value
    : escapeHtml(text);
  const out = [];
  const open = [];
  let cur = '';
  let last = 0;
  const re = /<span[^>]*>|<\/span>|\n/g;
  for (let m; (m = re.exec(html)); last = re.lastIndex) {
    cur += html.slice(last, m.index);
    if (m[0] === '\n') {
      out.push(cur + '</span>'.repeat(open.length));
      cur = open.join('');
    } else {
      if (m[0] === '</span>') open.pop();
      else open.push(m[0]);
      cur += m[0];
    }
  }
  out.push(cur + html.slice(last) + '</span>'.repeat(open.length));
  return out;
}
