'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const cli = path.resolve(__dirname, '..', 'resources', 'scripts', 'steward');

function run(arguments_, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...arguments_], {
    encoding: 'utf8',
  });
  assert.equal(
    result.status,
    expectedStatus,
    `command: ${arguments_.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function workspace(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'steward-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function makeReady(file) {
  let text = fs.readFileSync(file, 'utf8');
  text = text
    .replace('TODO: State the user or business outcome.', 'Users can obtain a deterministic greeting.')
    .replace(
      'TODO: Include the facts a builder needs without this conversation.',
      'The existing command prints plain text to standard output.',
    )
    .replace('- TODO\n\n### Out of scope', '- Add a greeting flag.\n\n### Out of scope')
    .replace('- TODO\n\n## Requirements', '- Changes to persistent storage.\n\n## Requirements')
    .replace('- R1: TODO', '- R1: The command accepts a --greet NAME option.')
    .replace(
      '- AC1: TODO\n\n## Evidence plan',
      '- AC1: Running with --greet Ada prints Hello, Ada.\n\n## Evidence plan',
    )
    .replace(
      '- AC1: TODO\n\n## Constraints',
      '- AC1: Run the command with --greet Ada and capture stdout.\n\n## Constraints',
    )
    .replace('- TODO\n', '- None.\n');
  fs.writeFileSync(file, text);
}

test('create, check, approve, and frozen-integrity check', (t) => {
  const directory = workspace(t);
  const ticket = path.join(directory, 'greeting.r1.md');

  run(['create', ticket, '--id', 'greeting', '--title', 'Add greeting option']);
  const draft = JSON.parse(run(['check', ticket, '--json']).stdout);
  assert.equal(draft.valid, true);
  assert.equal(draft.state, 'draft');

  run(['approve', ticket, '--by', 'Scope Owner'], 1);
  makeReady(ticket);
  const approved = run(['approve', ticket, '--by', 'Scope Owner']);
  assert.match(approved.stdout, /^approved greeting@1 frozen=[a-f0-9]{64}$/m);

  const frozen = JSON.parse(run(['check', ticket, '--json']).stdout);
  assert.equal(frozen.valid, true);
  assert.equal(frozen.state, 'approved');
  assert.match(frozen.frozen_body_sha256, /^[a-f0-9]{64}$/);

  const tampered = fs.readFileSync(ticket, 'utf8').replace(
    'Users can obtain a deterministic greeting.',
    'Users can obtain a different greeting.',
  );
  fs.writeFileSync(ticket, tampered);
  const invalid = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes('approved contract body differs from its frozen_body_sha256'));
});

test('new revisions preserve the approved artifact and compare section changes', (t) => {
  const directory = workspace(t);
  const first = path.join(directory, 'greeting.r1.md');
  const second = path.join(directory, 'greeting.r2.md');

  run(['create', first, '--id', 'greeting', '--title', 'Add greeting option']);
  makeReady(first);
  run(['approve', first, '--by', 'Scope Owner']);
  const frozenFirst = fs.readFileSync(first, 'utf8');

  run(['create', second, '--from', first]);
  assert.equal(fs.readFileSync(first, 'utf8'), frozenFirst);
  let revision = fs.readFileSync(second, 'utf8');
  revision = revision.replace(
    'Users can obtain a deterministic greeting.',
    'Users can obtain a localized deterministic greeting.',
  );
  fs.writeFileSync(second, revision);

  const comparison = JSON.parse(run(['compare', first, second, '--json']).stdout);
  assert.equal(comparison.contract_id, 'greeting');
  assert.equal(comparison.from_revision, 1);
  assert.equal(comparison.to_revision, 2);
  assert.equal(comparison.revision_increased, true);
  assert.equal(comparison.body_changed, true);
  assert.deepEqual(comparison.changed_sections, ['Intent']);
  assert.equal(comparison.changes[0].section, 'Intent');
  assert.match(comparison.changes[0].before, /deterministic greeting/);
  assert.match(comparison.changes[0].after, /localized deterministic greeting/);

  const secondCheck = JSON.parse(run(['check', second, '--json']).stdout);
  assert.equal(secondCheck.valid, true);
  assert.equal(secondCheck.state, 'draft');
});

test('assessment scaffold is claim-level and requires a frozen contract', (t) => {
  const directory = workspace(t);
  const ticket = path.join(directory, 'greeting.r1.md');
  const assessment = path.join(directory, 'assessment.md');

  run(['create', ticket, '--id', 'greeting', '--title', 'Add greeting option']);
  makeReady(ticket);
  run(['assessment', ticket, '--output', assessment], 1);
  run(['approve', ticket, '--by', 'Scope Owner']);
  run(['assessment', ticket, '--output', assessment, '--change-ref', 'working tree']);

  const report = fs.readFileSync(assessment, 'utf8');
  assert.match(report, /^steward_assessment: "1"$/m);
  assert.match(report, /^contract_revision: 1$/m);
  assert.match(report, /^\| AC1 \| inconclusive \| Not assessed\. \|/m);
  assert.match(report, /^Outcome: inconclusive$/m);
  run(['assessment', ticket, '--output', assessment], 1);
});

test('structure check rejects evidence that does not cover the claims', (t) => {
  const directory = workspace(t);
  const ticket = path.join(directory, 'greeting.r1.md');

  run(['create', ticket, '--id', 'greeting', '--title', 'Add greeting option']);
  makeReady(ticket);
  const malformed = fs.readFileSync(ticket, 'utf8').replace(
    '- AC1: Run the command with --greet Ada and capture stdout.',
    '- AC2: Run the command with --greet Ada and capture stdout.',
  );
  fs.writeFileSync(ticket, malformed);

  const result = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('Evidence plan must contain exactly one row for every acceptance claim'));
});
