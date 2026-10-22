const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'memento-entrypoints-')));
after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
const helper = path.resolve(__dirname, '../../_shared/scripts/global-entrypoints');
const resolver = path.resolve(__dirname, '../../_shared/scripts/memento-root');
let sequence = 0;
function fixture() {
  const dir = path.join(sandbox, String(++sequence));
  const root = path.join(dir, 'shared notes');
  const codex = path.join(dir, 'codex');
  const claude = path.join(dir, 'claude');
  for (const sub of ['sources', 'wiki']) fs.mkdirSync(path.join(root, sub), { recursive: true });
  fs.mkdirSync(codex);
  fs.mkdirSync(claude);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Shared rules\n\nUse the approved workflow.\n');
  return { dir, root, codex, claude };
}
function invoke(f, args) {
  return spawnSync(process.execPath, [helper, ...args, '--codex-home', f.codex, '--claude-home', f.claude], { encoding: 'utf8' });
}
function configure(f, apply = false) {
  return invoke(f, ['configure', '--root', f.root, ...(apply ? ['--apply'] : [])]);
}

test('preview writes nothing; fresh setup creates only one-line references', () => {
  const f = fixture();
  const before = fs.readFileSync(path.join(f.root, 'AGENTS.md'));
  const preview = configure(f);
  assert.equal(preview.status, 0, preview.stderr);
  assert.deepEqual(JSON.parse(preview.stdout).entrypoints.map(e => e.status), ['create', 'create']);
  assert.deepEqual(fs.readdirSync(f.codex), []);
  assert.deepEqual(fs.readdirSync(f.claude), []);
  assert.equal(configure(f, true).status, 0);
  assert.equal(fs.readFileSync(path.join(f.codex, 'AGENTS.md'), 'utf8'), `Read and follow [Memento](<${f.root}/AGENTS.md>).\n`);
  assert.equal(fs.readFileSync(path.join(f.claude, 'CLAUDE.md'), 'utf8'), `@${f.root.replace(/ /g, '\\ ')}/AGENTS.md\n`);
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'AGENTS.md')), before);
  assert.equal(invoke(f, ['resolve']).stdout.trim(), fs.realpathSync(f.root));
});

test('repeated setup leaves existing entrypoints untouched', () => {
  const f = fixture();
  assert.equal(configure(f, true).status, 0);
  const file = path.join(f.codex, 'AGENTS.md');
  const before = fs.statSync(file).mtimeMs;
  const repeat = configure(f, true);
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.deepEqual(JSON.parse(repeat.stdout).entrypoints.map(e => e.status), ['unchanged', 'unchanged']);
  assert.equal(fs.statSync(file).mtimeMs, before);
});

test('migration preview and apply preserve competing instructions without partial writes', () => {
  const f = fixture();
  const file = path.join(f.claude, 'CLAUDE.md');
  const original = '# Existing rules\nKeep these until the user reviews migration.\n';
  fs.writeFileSync(file, original);
  const preview = configure(f);
  assert.equal(JSON.parse(preview.stdout).entrypoints[1].status, 'migration-required');
  const apply = configure(f, true);
  assert.notEqual(apply.status, 0);
  assert.match(apply.stderr, /reviewed migration/);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.deepEqual(fs.readdirSync(f.codex), []);
});

test('reviewed migration can be verified without losing the preserved original', () => {
  const f = fixture();
  const file = path.join(f.codex, 'AGENTS.md');
  const original = '# Existing user policy\n';
  fs.writeFileSync(file, original);
  assert.notEqual(configure(f, true).status, 0);
  const backup = path.join(f.dir, 'approved-policy-backup.md');
  fs.renameSync(file, backup);
  fs.appendFileSync(path.join(f.root, 'AGENTS.md'), '\nApproved migrated policy.\n');
  assert.equal(configure(f, true).status, 0);
  assert.equal(fs.readFileSync(backup, 'utf8'), original);
  assert.equal(JSON.parse(configure(f).stdout).entrypoints[0].status, 'unchanged');
});

test('a competing symlink is not followed or replaced', () => {
  const f = fixture();
  const external = path.join(f.dir, 'unrelated.md');
  fs.writeFileSync(external, 'untouched\n');
  fs.symlinkSync(external, path.join(f.codex, 'AGENTS.md'));
  assert.notEqual(configure(f, true).status, 0);
  assert.equal(fs.readFileSync(external, 'utf8'), 'untouched\n');
  assert.deepEqual(fs.readdirSync(f.claude), []);
});

test('Codex override blocks installation without changing either harness', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.codex, 'AGENTS.override.md'), 'competing policy\n');
  const result = configure(f, true);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /override shadows/);
  assert.deepEqual(fs.readdirSync(f.claude), []);
});

test('different global roots fail instead of selecting a harness arbitrarily', () => {
  const f = fixture();
  const other = fixture();
  assert.equal(configure(f, true).status, 0);
  fs.writeFileSync(path.join(f.claude, 'CLAUDE.md'), `@${other.root.replace(/ /g, '\\ ')}/AGENTS.md\n`);
  assert.match(invoke(f, ['resolve']).stderr, /different Mementos/);
});

test('single-harness setup does not create the other entrypoint', () => {
  const f = fixture();
  const result = spawnSync(process.execPath, [helper, 'configure', '--root', f.root, '--codex-home', f.codex, '--apply'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(f.claude), []);
});

test('resolver works from another project; environment and markers keep precedence', () => {
  const f = fixture();
  const other = fixture();
  assert.equal(configure(f, true).status, 0);
  const project = path.join(f.dir, 'application');
  fs.mkdirSync(project);
  const env = { ...process.env, CODEX_HOME: f.codex, CLAUDE_CONFIG_DIR: f.claude };
  delete env.MEMENTO_ROOT;
  const run = () => spawnSync('bash', [resolver], { cwd: project, env, encoding: 'utf8' });
  assert.equal(run().stdout.trim(), fs.realpathSync(f.root));
  fs.writeFileSync(path.join(project, '.memento-root'), other.root + '\n');
  assert.equal(run().stdout.trim(), fs.realpathSync(other.root));
  env.MEMENTO_ROOT = f.root;
  assert.equal(run().stdout.trim(), fs.realpathSync(f.root));
});
