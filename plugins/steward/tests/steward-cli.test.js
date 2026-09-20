'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const cli = path.resolve(__dirname, '..', 'resources', 'scripts', 'steward');
const exampleContract = path.resolve(__dirname, '..', 'examples', 'delivery-status.contract.md');
const gitIdentity = `git:${'a'.repeat(40)}`;
const remediationActions = {
  none: 'None.',
  implementation:
    'Correct the implementation against this frozen contract, record a new immutable change identity, and reassess.',
  contract:
    'Keep this approved contract immutable; derive a revised draft, critique and explicitly approve it, then build and assess the successor revision.',
  evidence:
    'Collect or reconcile the missing evidence, then reassess this same frozen contract and immutable change unless the implementation changes.',
};

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

function replaceInFile(file, replacements) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) {
    assert.ok(text.includes(from), `fixture did not contain expected text: ${from}`);
    text = text.replace(from, to);
  }
  fs.writeFileSync(file, text);
}

function makeReady(file) {
  replaceInFile(file, [
    [
      'TODO: State the requested user or business result.',
      'Users can obtain a deterministic greeting.',
    ],
    [
      '- AC1: TODO: State an observable result that distinguishes success from failure.',
      '- AC1: Running with --greet Ada prints Hello, Ada.',
    ],
  ]);
}

function createReady(directory, name = 'greeting.r1.md') {
  const ticket = path.join(directory, name);
  run(['create', ticket, '--id', 'greeting', '--title', 'Add greeting option']);
  makeReady(ticket);
  return ticket;
}

function approveReady(directory, name = 'greeting.r1.md') {
  const ticket = createReady(directory, name);
  run(['approve', ticket, '--by', 'Scope Owner']);
  return ticket;
}

function scaffoldAssessment(contract, assessment) {
  run([
    'assessment',
    contract,
    '--output',
    assessment,
    '--change-id',
    gitIdentity,
    '--environment',
    'Node 24 on synthetic fixtures in a clean checkout',
    '--assessor',
    'Independent Assessor',
  ]);
}

function makeAssessmentPass(file) {
  replaceInFile(file, [
    ['Outcome: inconclusive', 'Outcome: pass'],
    ['- Outcome: inconclusive', '- Outcome: pass'],
    ['- Evidence: None.', '- Evidence: E1'],
    [
      '- Residual uncertainty: Evidence has not yet been collected.',
      '- Residual uncertainty: Name encoding outside the contract remains unassessed.',
    ],
    [
      '## Evidence log\n\n- None.',
      `## Evidence log

### E1
- Command or artifact: \`node --test greeting.test.js\` at ${gitIdentity}
- Observation: The Ada scenario printed Hello, Ada and exited 0.`,
    ],
    ['- Assessment is incomplete.', '- Name encoding outside the contract remains unassessed.'],
    ['Classification: insufficient-or-conflicting-evidence', 'Classification: none'],
    [`Next action: ${remediationActions.evidence}`, `Next action: ${remediationActions.none}`],
  ]);
}

function makeAssessmentFail(file, classification, action) {
  replaceInFile(file, [
    ['Outcome: inconclusive', 'Outcome: fail'],
    ['- Outcome: inconclusive', '- Outcome: fail'],
    ['- Evidence: None.', '- Evidence: E1'],
    [
      '- Residual uncertainty: Evidence has not yet been collected.',
      '- Residual uncertainty: Other names were not sampled.',
    ],
    [
      '## Evidence log\n\n- None.',
      `## Evidence log

### E1
- Command or artifact: \`node greeting.js --greet Ada\` at ${gitIdentity}
- Observation: The command printed Goodbye, Ada and exited 0.`,
    ],
    ['- Assessment is incomplete.', '- Other names were not sampled.'],
    ['Classification: insufficient-or-conflicting-evidence', `Classification: ${classification}`],
    [`Next action: ${remediationActions.evidence}`, `Next action: ${action}`],
  ]);
}

test('the contract defaults stay lean and preserve frozen integrity', (t) => {
  const directory = workspace(t);
  const ticket = path.join(directory, 'lean.r1.md');
  run(['create', ticket, '--id', 'lean', '--title', 'Lean contract']);

  const draft = fs.readFileSync(ticket, 'utf8');
  assert.match(draft, /^## Outcome$/m);
  assert.match(draft, /^## Acceptance$/m);
  assert.doesNotMatch(draft, /^## (?:Requirements|Evidence plan|Intent probes)$/m);

  const check = JSON.parse(run(['check', ticket, '--json']).stdout);
  assert.equal(check.structurally_valid, true);
  assert.equal(check.valid, true);
  assert.equal(check.metrics.acceptance_claims, 1);
  assert.match(run(['approve', ticket, '--by', 'Owner'], 1).stderr, /placeholders/);

  makeReady(ticket);
  assert.match(run(['check', ticket]).stdout, /^STRUCTURALLY OK /);
  run(['approve', ticket, '--by', 'Scope Owner']);
  replaceInFile(ticket, [['Users can obtain', 'Users might obtain']]);
  const tampered = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
  assert.ok(tampered.errors.includes('approved contract body differs from its frozen_body_sha256'));
});
test('contracts accept only ordered optional sections and plain unique claims', async (t) => {
  await t.test('optional context and scope remain structurally valid', () => {
    const directory = workspace(t);
    const ticket = createReady(directory);
    replaceInFile(ticket, [[
      '## Acceptance',
      `## Context

The current command prints plain text.

## Scope

### Change

- Add a greeting flag.

### Preserve

- Existing output without the flag.

### Not in scope

- Localization.

## Acceptance`,
    ]]);
    run(['check', ticket]);
  });

  await t.test('duplicate, unknown, and reordered H2 sections fail', () => {
    const directory = workspace(t);
    const duplicate = createReady(directory, 'duplicate.md');
    replaceInFile(duplicate, [['## Acceptance', '## Outcome\n\nRepeated.\n\n## Acceptance']]);
    assert.match(run(['check', duplicate], 1).stdout, /duplicate H2 section/);

    const unknown = createReady(directory, 'unknown.md');
    replaceInFile(unknown, [['## Acceptance', '## Architecture\n\nNone.\n\n## Acceptance']]);
    assert.match(run(['check', unknown], 1).stdout, /unknown contract H2 section/);

    const reordered = createReady(directory, 'reordered.md');
    replaceInFile(reordered, [[
      '## Outcome\n\nUsers can obtain a deterministic greeting.\n\n## Acceptance',
      '## Acceptance',
    ], [
      '- AC1: Running with --greet Ada prints Hello, Ada.',
      '- AC1: Running with --greet Ada prints Hello, Ada.\n\n## Outcome\n\nUsers can obtain a deterministic greeting.',
    ]]);
    assert.match(run(['check', reordered], 1).stdout, /must follow this order/);
  });

  await t.test('duplicate claims and unresolved questions fail', () => {
    const directory = workspace(t);
    const duplicate = createReady(directory, 'duplicate-claim.md');
    replaceInFile(duplicate, [[
      '- AC1: Running with --greet Ada prints Hello, Ada.',
      '- AC1: Running with --greet Ada prints Hello, Ada.\n- AC1: Running with --greet Lin prints Hello, Lin.',
    ]]);
    assert.match(run(['check', duplicate], 1).stdout, /duplicate acceptance claim/);

    const untracked = createReady(directory, 'untracked-acceptance.md');
    replaceInFile(untracked, [[
      '- AC1: Running with --greet Ada prints Hello, Ada.',
      '- AC1: Running with --greet Ada prints Hello, Ada.\n- Existing behavior must remain unchanged.',
    ]]);
    assert.match(run(['check', untracked], 1).stdout, /may contain only single-line/);

    const question = createReady(directory, 'question.md');
    replaceInFile(question, [[
      '- AC1: Running with --greet Ada prints Hello, Ada.',
      '- AC1: Running with --greet Ada prints Hello, Ada.\n\n## Open questions\n\n- Which greeting language?',
    ]]);
    assert.match(run(['approve', question, '--by', 'Owner'], 1).stderr, /Open questions/);
  });

  await t.test('technical angle brackets are not treated as placeholders', () => {
    const directory = workspace(t);
    const ticket = createReady(directory, 'technical-syntax.md');
    replaceInFile(ticket, [[
      '- AC1: Running with --greet Ada prints Hello, Ada.',
      '- AC1: The greeting form renders a native <button> labelled Greet.',
    ]]);
    run(['approve', ticket, '--by', 'Scope Owner']);
    assert.equal(JSON.parse(run(['check', ticket, '--json']).stdout).valid, true);
  });
});
test('retired migration commands stay unsupported', (t) => {
  const directory = workspace(t);
  const contract = createReady(directory);
  assert.match(run(['create', path.join(directory, 'old.md'), '--id', 'old', '--title', 'Old', '--format', '2'], 2).stderr, /unknown option --format/);
  assert.match(run(['migrate', contract, '--output', path.join(directory, 'migrated.md')], 2).stderr, /unknown command: migrate/);
});
test('assessment selects post-build evidence without EV methods', (t) => {
  const directory = workspace(t);
  const contract = approveReady(directory);
  const assessment = path.join(directory, 'assessment.md');
  scaffoldAssessment(contract, assessment);

  const scaffold = fs.readFileSync(assessment, 'utf8');
  assert.doesNotMatch(scaffold, /Contract method:/);
  makeAssessmentPass(assessment);
  run(['assessment-complete', assessment]);

  const completed = JSON.parse(run(['assessment-check', assessment, '--json']).stdout);
  assert.equal(completed.valid, true);
  assert.equal(completed.state, 'completed');
});
test('compare reports contract growth without blocking approval', (t) => {
  const directory = workspace(t);
  const first = approveReady(directory, 'growth.r1.md');
  const second = path.join(directory, 'growth.r2.md');
  run(['create', second, '--from', first]);
  replaceInFile(second, [[
    '- AC1: Running with --greet Ada prints Hello, Ada.',
    '- AC1: Running with --greet Ada prints Hello, Ada.\n- AC2: Running with --greet Lin prints Hello, Lin.',
  ]]);
  const compared = JSON.parse(run(['compare', first, second, '--json']).stdout);
  assert.equal(compared.metric_delta.acceptance_claims, 1);
  assert.ok(compared.metric_delta.body_words > 0);
});
test('shipped example remains structurally valid', () => {
  const result = JSON.parse(run(['check', exampleContract, '--json']).stdout);
  assert.equal(result.valid, true);
  assert.equal(result.state, 'draft');
});
test('assessment scaffold requires immutable provenance and verifies the referenced contract', (t) => {
  const directory = workspace(t);
  const ticket = approveReady(directory);
  const assessment = path.join(directory, 'assessment.md');

  run(['assessment', ticket, '--output', assessment], 2);
  run([
    'assessment',
    ticket,
    '--output',
    assessment,
    '--change-id',
    'git:main',
    '--environment',
    'Node 24',
    '--assessor',
    'Assessor',
  ], 1);
  run([
    'assessment',
    ticket,
    '--output',
    assessment,
    '--change-id',
    'branch:feature-name',
    '--environment',
    'Node 24',
    '--assessor',
    'Assessor',
  ], 1);
  scaffoldAssessment(ticket, assessment);

  const result = JSON.parse(run(['assessment-check', assessment, '--json']).stdout);
  assert.equal(result.valid, true);
  assert.equal(result.change_identity, gitIdentity);
  assert.equal(result.state, 'draft');
  const report = fs.readFileSync(assessment, 'utf8');
  assert.match(report, /^contract_body_sha256: "[a-f0-9]{64}"$/m);
  assert.match(report, /^environment: "Node 24 on synthetic fixtures in a clean checkout"$/m);
  assert.match(report, /^assessor: "Independent Assessor"$/m);
});
test('completed assessment cannot claim pass without per-claim commands and observations', (t) => {
  const directory = workspace(t);
  const ticket = approveReady(directory);
  const assessment = path.join(directory, 'assessment.md');
  scaffoldAssessment(ticket, assessment);

  replaceInFile(assessment, [
    ['Outcome: inconclusive', 'Outcome: pass'],
    ['- Outcome: inconclusive', '- Outcome: pass'],
    ['Classification: insufficient-or-conflicting-evidence', 'Classification: none'],
    [`Next action: ${remediationActions.evidence}`, `Next action: ${remediationActions.none}`],
  ]);
  const rejected = run(['assessment-complete', assessment], 1);
  assert.match(rejected.stderr, /AC1 cannot claim pass without per-claim evidence/);

  replaceInFile(assessment, [
    ['- Evidence: None.', '- Evidence: E1'],
    [
      '## Evidence log\n\n- None.',
      `## Evidence log

### E1
- Command or artifact: \`node --test greeting.test.js\` at ${gitIdentity}
- Observation: The Ada scenario printed Hello, Ada and exited 0.`,
    ],
  ]);
  run(['assessment-complete', assessment]);
  const completed = JSON.parse(run(['assessment-check', assessment, '--json']).stdout);
  assert.equal(completed.valid, true);
  assert.equal(completed.state, 'completed');

  replaceInFile(assessment, [['The Ada scenario printed', 'A different scenario printed']]);
  const tampered = JSON.parse(run(['assessment-check', assessment, '--json'], 1).stdout);
  assert.ok(tampered.errors.includes('completed assessment body differs from its assessment_body_sha256'));
});
test('all-pass assessment completes with evidence and a frozen report hash', (t) => {
  const directory = workspace(t);
  const ticket = approveReady(directory);
  const assessment = path.join(directory, 'assessment.md');
  scaffoldAssessment(ticket, assessment);
  makeAssessmentPass(assessment);

  const completion = run(['assessment-complete', assessment]);
  assert.match(completion.stdout, /change=git:[a-f0-9]{40} frozen=[a-f0-9]{64}/);
  const report = fs.readFileSync(assessment, 'utf8');
  assert.match(report, /^state: completed$/m);
  assert.match(report, /^assessment_body_sha256: "[a-f0-9]{64}"$/m);
  assert.match(report, /^Classification: none$/m);
});
test('non-pass assessments enforce remediation classification and required next action', async (t) => {
  await t.test('implementation defect', () => {
    const directory = workspace(t);
    const ticket = approveReady(directory);
    const assessment = path.join(directory, 'implementation.md');
    scaffoldAssessment(ticket, assessment);
    makeAssessmentFail(assessment, 'implementation-defect', remediationActions.implementation);
    run(['assessment-complete', assessment]);
  });

  await t.test('contract defect routes through revised approval', () => {
    const directory = workspace(t);
    const ticket = approveReady(directory);
    const assessment = path.join(directory, 'contract.md');
    scaffoldAssessment(ticket, assessment);
    makeAssessmentFail(assessment, 'contract-defect', remediationActions.contract);
    run(['assessment-complete', assessment]);
  });

  await t.test('insufficient evidence can complete as inconclusive', () => {
    const directory = workspace(t);
    const ticket = approveReady(directory);
    const assessment = path.join(directory, 'evidence.md');
    scaffoldAssessment(ticket, assessment);
    replaceInFile(assessment, [
      ['- Assessment is incomplete.', '- The relevant runtime was unavailable to the assessor.'],
    ]);
    run(['assessment-complete', assessment]);
  });

  await t.test('non-pass assessment requires a concrete next action', () => {
    const directory = workspace(t);
    const ticket = approveReady(directory);
    const assessment = path.join(directory, 'mismatch.md');
    scaffoldAssessment(ticket, assessment);
    makeAssessmentFail(assessment, 'contract-defect', 'None.');
    const result = run(['assessment-complete', assessment], 1);
    assert.match(result.stderr, /must state a concrete next step/);
  });
});
