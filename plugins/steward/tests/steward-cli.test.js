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

function makeV2Ready(file) {
  replaceInFile(file, [
    [
      '- I1: TODO: State the user-observable or business outcome.',
      '- I1: Users can obtain a deterministic greeting.',
    ],
    [
      'TODO: Include the facts a builder needs without this conversation.',
      'The existing command prints plain text to standard output.',
    ],
    ['- TODO\n\n### Out of scope', '- Add a greeting flag.\n\n### Out of scope'],
    ['- TODO\n\n## Requirements', '- Changes to persistent storage.\n\n## Requirements'],
    [
      '- R1 [I1]: TODO: State required behavior, not an implementation preference.',
      '- R1 [I1]: The command accepts a --greet NAME option.',
    ],
    [
      '- AC1 [I1; R1]: TODO: State an independently assessable claim.',
      '- AC1 [I1; R1]: Running with --greet Ada prints Hello, Ada.',
    ],
    [
      '- EV1 [AC1]: TODO: Name a reproducible observation, command, or artifact.',
      '- EV1 [AC1]: Run the command with --greet Ada and capture standard output.',
    ],
    [
      '- P1 [normal; AC1; EV1]: TODO: Given a representative normal situation, state the user-observable result.',
      '- P1 [normal; AC1; EV1]: Given the name Ada, the user sees Hello, Ada.',
    ],
    [
      '- P2 [boundary; AC1; EV1]: TODO: Given a representative boundary or failure situation, state the user-observable result.',
      '- P2 [boundary; AC1; EV1]: Given a one-character name, the user sees that name without truncation.',
    ],
    [
      '- P3 [accepted-tradeoff; AC1; EV1]: TODO: State an explicitly accepted tradeoff and its user-observable consequence.',
      '- P3 [accepted-tradeoff; AC1; EV1]: Names are echoed without localization in this revision.',
    ],
  ]);
}

function createReadyV2(directory, name = 'greeting.r1.md') {
  const ticket = path.join(directory, name);
  run(['create', ticket, '--id', 'greeting', '--title', 'Add greeting option', '--format', '2']);
  makeV2Ready(ticket);
  return ticket;
}

function approveV2(directory, name = 'greeting.r1.md') {
  const ticket = createReadyV2(directory, name);
  run(['approve', ticket, '--by', 'Scope Owner']);
  return ticket;
}

function makeV3Ready(file) {
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

function createReadyV3(directory, name = 'greeting-v3.r1.md') {
  const ticket = path.join(directory, name);
  run(['create', ticket, '--id', 'greeting-v3', '--title', 'Add lean greeting option']);
  makeV3Ready(ticket);
  return ticket;
}

function approveV3(directory, name = 'greeting-v3.r1.md') {
  const ticket = createReadyV3(directory, name);
  run(['approve', ticket, '--by', 'Scope Owner']);
  return ticket;
}

function writeLegacyV1(file) {
  fs.writeFileSync(file, `---
steward_contract: "1"
id: "legacy-greeting"
title: "Add legacy greeting"
revision: 1
state: draft
created_at: "2026-01-01T00:00:00.000Z"
approved_at: null
approved_by: null
frozen_body_sha256: null
supersedes: null
---
# Add legacy greeting

## Intent

Users receive a deterministic greeting.

## Context

The command writes plain text.

## Scope

### In scope

- Greeting output.

### Out of scope

- Localization.

## Requirements

- R1: Accept a name.

## Acceptance claims

- AC1: Ada produces Hello, Ada.

## Evidence plan

- AC1: Run the command and capture output.

## Constraints

- None.

## Assumptions and risks

### Assumptions

- None.

### Risks

- None.

## Open questions

- None.
`);
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
    '--format',
    '2',
  ]);
}

function scaffoldAssessmentV3(contract, assessment) {
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
- Contract method: EV1
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
- Contract method: EV1
- Command or artifact: \`node greeting.js --greet Ada\` at ${gitIdentity}
- Observation: The command printed Goodbye, Ada and exited 0.`,
    ],
    ['- Assessment is incomplete.', '- Other names were not sampled.'],
    ['Classification: insufficient-or-conflicting-evidence', `Classification: ${classification}`],
    [`Next action: ${remediationActions.evidence}`, `Next action: ${action}`],
  ]);
}

function makeAssessmentV3Pass(file) {
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

test('format v3 defaults to a lean contract and preserves frozen integrity', (t) => {
  const directory = workspace(t);
  const ticket = path.join(directory, 'lean.r1.md');
  run(['create', ticket, '--id', 'lean', '--title', 'Lean contract']);

  const draft = fs.readFileSync(ticket, 'utf8');
  assert.match(draft, /^steward_contract: "3"$/m);
  assert.match(draft, /^## Outcome$/m);
  assert.match(draft, /^## Acceptance$/m);
  assert.doesNotMatch(draft, /^## (?:Requirements|Evidence plan|Intent probes)$/m);

  const check = JSON.parse(run(['check', ticket, '--json']).stdout);
  assert.equal(check.structurally_valid, true);
  assert.equal(check.valid, true);
  assert.equal(check.metrics.acceptance_claims, 1);
  assert.match(run(['approve', ticket, '--by', 'Owner'], 1).stderr, /placeholders/);

  makeV3Ready(ticket);
  assert.match(run(['check', ticket]).stdout, /^STRUCTURALLY OK /);
  run(['approve', ticket, '--by', 'Scope Owner']);
  replaceInFile(ticket, [['Users can obtain', 'Users might obtain']]);
  const tampered = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
  assert.ok(tampered.errors.includes('approved contract body differs from its frozen_body_sha256'));
});

test('format v3 accepts only ordered optional sections and plain unique claims', async (t) => {
  await t.test('optional context and scope remain structurally valid', () => {
    const directory = workspace(t);
    const ticket = createReadyV3(directory);
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
    const duplicate = createReadyV3(directory, 'duplicate.md');
    replaceInFile(duplicate, [['## Acceptance', '## Outcome\n\nRepeated.\n\n## Acceptance']]);
    assert.match(run(['check', duplicate], 1).stdout, /duplicate H2 section/);

    const unknown = createReadyV3(directory, 'unknown.md');
    replaceInFile(unknown, [['## Acceptance', '## Architecture\n\nNone.\n\n## Acceptance']]);
    assert.match(run(['check', unknown], 1).stdout, /unknown format-v3 H2 section/);

    const reordered = createReadyV3(directory, 'reordered.md');
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
    const duplicate = createReadyV3(directory, 'duplicate-claim.md');
    replaceInFile(duplicate, [[
      '- AC1: Running with --greet Ada prints Hello, Ada.',
      '- AC1: Running with --greet Ada prints Hello, Ada.\n- AC1: Running with --greet Lin prints Hello, Lin.',
    ]]);
    assert.match(run(['check', duplicate], 1).stdout, /duplicate acceptance claim/);

    const untracked = createReadyV3(directory, 'untracked-acceptance.md');
    replaceInFile(untracked, [[
      '- AC1: Running with --greet Ada prints Hello, Ada.',
      '- AC1: Running with --greet Ada prints Hello, Ada.\n- Existing behavior must remain unchanged.',
    ]]);
    assert.match(run(['check', untracked], 1).stdout, /may contain only single-line/);

    const question = createReadyV3(directory, 'question.md');
    replaceInFile(question, [[
      '- AC1: Running with --greet Ada prints Hello, Ada.',
      '- AC1: Running with --greet Ada prints Hello, Ada.\n\n## Open questions\n\n- Which greeting language?',
    ]]);
    assert.match(run(['approve', question, '--by', 'Owner'], 1).stderr, /Open questions/);
  });
});

test('format v3 assessment selects post-build evidence without EV methods', (t) => {
  const directory = workspace(t);
  const contract = approveV3(directory);
  const assessment = path.join(directory, 'assessment-v3.md');
  scaffoldAssessmentV3(contract, assessment);

  const scaffold = fs.readFileSync(assessment, 'utf8');
  assert.match(scaffold, /^steward_assessment: "3"$/m);
  assert.doesNotMatch(scaffold, /Contract method:/);
  makeAssessmentV3Pass(assessment);
  run(['assessment-complete', assessment]);

  const completed = JSON.parse(run(['assessment-check', assessment, '--json']).stdout);
  assert.equal(completed.valid, true);
  assert.equal(completed.format, '3');
  assert.equal(completed.state, 'completed');
  const incompatible = path.join(directory, 'assessment-v2.md');
  assert.match(
    run([
      'assessment',
      contract,
      '--output',
      incompatible,
      '--change-id',
      gitIdentity,
      '--environment',
      'Synthetic',
      '--assessor',
      'Assessor',
      '--format',
      '2',
    ], 1).stderr,
    /format v2 requires a format-v2 contract/,
  );
});

test('format-v2 contracts preserve EV assessment semantics by default', (t) => {
  const directory = workspace(t);
  const contract = approveV2(directory);
  const assessment = path.join(directory, 'assessment-v2-default.md');
  scaffoldAssessmentV3(contract, assessment);
  assert.match(fs.readFileSync(assessment, 'utf8'), /^steward_assessment: "2"$/m);

  const incompatible = path.join(directory, 'assessment-v3.md');
  assert.match(
    run([
      'assessment',
      contract,
      '--output',
      incompatible,
      '--change-id',
      gitIdentity,
      '--environment',
      'Synthetic',
      '--assessor',
      'Assessor',
      '--format',
      '3',
    ], 1).stderr,
    /format-v2 contracts require assessment v2/,
  );
});

test('approved legacy contract can start a blank format-v3 successor with lineage', (t) => {
  const directory = workspace(t);
  const contract = approveV2(directory);
  const successor = path.join(directory, 'greeting.r2.md');
  run(['create', successor, '--from', contract, '--format', '3']);
  const draft = fs.readFileSync(successor, 'utf8');
  assert.match(draft, /^steward_contract: "3"$/m);
  assert.match(draft, /^revision: 2$/m);
  assert.match(draft, /^supersedes: "greeting@1"$/m);
  assert.match(draft, /^## Outcome$/m);
  assert.doesNotMatch(draft, /^## Requirements$/m);
  makeV3Ready(successor);
  run(['approve', successor, '--by', 'Scope Owner']);

  const assessment = path.join(directory, 'assessment-v3.md');
  scaffoldAssessmentV3(successor, assessment);
  makeAssessmentV3Pass(assessment);
  run(['assessment-complete', assessment]);
  assert.equal(JSON.parse(run(['assessment-check', assessment, '--json']).stdout).valid, true);
});

test('compare reports format-v3 contract growth without blocking approval', (t) => {
  const directory = workspace(t);
  const first = approveV3(directory, 'growth.r1.md');
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

test('format v2 creates a traced draft, approves it, and detects frozen-body tampering', (t) => {
  const directory = workspace(t);
  const ticket = createReadyV2(directory);

  const draft = JSON.parse(run(['check', ticket, '--json']).stdout);
  assert.equal(draft.valid, true);
  assert.equal(draft.format, '2');
  assert.equal(draft.state, 'draft');

  const approved = run(['approve', ticket, '--by', 'Scope Owner']);
  assert.match(approved.stdout, /^approved greeting@1 format=v2 frozen=[a-f0-9]{64}$/m);
  const frozen = JSON.parse(run(['check', ticket, '--json']).stdout);
  assert.equal(frozen.valid, true);
  assert.equal(frozen.state, 'approved');

  replaceInFile(ticket, [
    ['Users can obtain a deterministic greeting.', 'Users can obtain a different greeting.'],
  ]);
  const invalid = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
  assert.ok(invalid.errors.includes('approved contract body differs from its frozen_body_sha256'));
});

test('shipped format-v3 example remains structurally valid', () => {
  const result = JSON.parse(run(['check', exampleContract, '--json']).stdout);
  assert.equal(result.valid, true);
  assert.equal(result.format, '3');
  assert.equal(result.state, 'draft');
});

test('traceability rejects orphaned requirements, untraced claims, and claims without evidence', async (t) => {
  await t.test('requirement without claim', () => {
    const directory = workspace(t);
    const ticket = createReadyV2(directory);
    replaceInFile(ticket, [['- AC1 [I1; R1]:', '- AC1 [I1; R2]:']]);
    const result = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
    assert.ok(result.errors.includes('AC1 references unknown requirement id(s): R2'));
    assert.ok(result.errors.includes('R1 lacks an acceptance claim'));
    assert.match(run(['approve', ticket, '--by', 'Owner'], 1).stderr, /not ready for approval/);
  });

  await t.test('claim without direct intent mapping', () => {
    const directory = workspace(t);
    const ticket = createReadyV2(directory);
    replaceInFile(ticket, [['- AC1 [I1; R1]:', '- AC1 [R1]:']]);
    const result = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
    assert.ok(result.errors.includes('AC1 must reference at least one intent id and one requirement id'));
  });

  await t.test('claim without evidence', () => {
    const directory = workspace(t);
    const ticket = createReadyV2(directory);
    replaceInFile(ticket, [['- EV1 [AC1]:', '- EV1 [AC2]:']]);
    const result = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
    assert.ok(result.errors.includes('EV1 references unknown acceptance claim(s): AC2'));
    assert.ok(result.errors.includes('AC1 lacks an evidence method'));
  });
});

test('intent probes require representative kinds and valid claim-to-evidence links', async (t) => {
  await t.test('missing boundary or failure probe', () => {
    const directory = workspace(t);
    const ticket = createReadyV2(directory);
    replaceInFile(ticket, [['- P2 [boundary;', '- P2 [normal;']]);
    const result = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
    assert.ok(result.errors.includes('Intent probes require at least one boundary or failure scenario'));
  });

  await t.test('missing accepted-tradeoff probe', () => {
    const directory = workspace(t);
    const ticket = createReadyV2(directory);
    replaceInFile(ticket, [['- P3 [accepted-tradeoff;', '- P3 [failure;']]);
    const result = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
    assert.ok(result.errors.includes('Intent probes require at least one accepted-tradeoff scenario'));
  });

  await t.test('probe evidence must cover its claim', () => {
    const directory = workspace(t);
    const ticket = createReadyV2(directory);
    replaceInFile(ticket, [['- P2 [boundary; AC1; EV1]:', '- P2 [boundary; AC1; EV2]:']]);
    const result = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
    assert.ok(result.errors.includes('P2 references unknown evidence method(s): EV2'));
    assert.ok(result.errors.includes('P2 has no referenced evidence method tied to AC1'));
  });
});

test('approval permits complete non-blocking unknowns and rejects only blocking or malformed ones', async (t) => {
  const nonBlocking = `### U1: Which localized wording should replace the fallback?
- Status: non-blocking
- Owner: Content design
- Decision deadline or trigger: Before localization launch
- Safe default: Use the approved English fallback
- Assessment rationale: AC1 remains observable under the English fallback`;

  await t.test('non-blocking unknown can remain at approval', () => {
    const directory = workspace(t);
    const ticket = createReadyV2(directory);
    replaceInFile(ticket, [['## Open questions\n\n- None.', `## Open questions\n\n${nonBlocking}`]]);
    run(['approve', ticket, '--by', 'Scope Owner']);
    assert.equal(JSON.parse(run(['check', ticket, '--json']).stdout).valid, true);
  });

  await t.test('blocking unknown prevents approval', () => {
    const directory = workspace(t);
    const ticket = createReadyV2(directory);
    replaceInFile(ticket, [
      ['## Open questions\n\n- None.', `## Open questions\n\n${nonBlocking.replace('non-blocking', 'blocking')}`],
    ]);
    const result = run(['approve', ticket, '--by', 'Scope Owner'], 1);
    assert.match(result.stderr, /validation-blocking open question\(s\): U1/);
  });

  await t.test('unknown missing owner fails structure check', () => {
    const directory = workspace(t);
    const ticket = createReadyV2(directory);
    replaceInFile(ticket, [
      [
        '## Open questions\n\n- None.',
        `## Open questions\n\n${nonBlocking.replace('- Owner: Content design\n', '')}`,
      ],
    ]);
    const result = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
    assert.ok(result.errors.includes('Open questions U1 is missing field(s): Owner'));
  });

  await t.test('non-blocking unknown needs a concrete safe default', () => {
    const directory = workspace(t);
    const ticket = createReadyV2(directory);
    replaceInFile(ticket, [
      [
        '## Open questions\n\n- None.',
        `## Open questions\n\n${nonBlocking.replace('Use the approved English fallback', 'None.')}`,
      ],
    ]);
    const result = JSON.parse(run(['check', ticket, '--json'], 1).stdout);
    assert.ok(result.errors.includes('U1 Safe default must name a concrete value'));
  });
});

test('approved format-v1 contracts remain valid and migrate without mutation', (t) => {
  const directory = workspace(t);
  const legacy = path.join(directory, 'legacy.r1.md');
  const migrated = path.join(directory, 'legacy.r2.md');
  const legacySuccessor = path.join(directory, 'legacy-v1.r2.md');
  writeLegacyV1(legacy);
  run(['approve', legacy, '--by', 'Legacy Scope Owner']);
  const frozenLegacy = fs.readFileSync(legacy, 'utf8');

  const legacyCheck = JSON.parse(run(['check', legacy, '--json']).stdout);
  assert.equal(legacyCheck.valid, true);
  assert.equal(legacyCheck.format, '1');

  run(['migrate', legacy, '--output', migrated]);
  assert.equal(fs.readFileSync(legacy, 'utf8'), frozenLegacy);
  const migratedCheck = JSON.parse(run(['check', migrated, '--json']).stdout);
  assert.equal(migratedCheck.valid, true);
  assert.equal(migratedCheck.format, '2');
  assert.equal(migratedCheck.revision, 2);
  assert.match(fs.readFileSync(migrated, 'utf8'), /MIGRATION TODO/);
  assert.match(run(['approve', migrated, '--by', 'Scope Owner'], 1).stderr, /placeholders/);

  run(['create', legacySuccessor, '--from', legacy]);
  const successorCheck = JSON.parse(run(['check', legacySuccessor, '--json']).stdout);
  assert.equal(successorCheck.valid, true);
  assert.equal(successorCheck.format, '1');
});

test('assessment scaffold requires immutable provenance and verifies the referenced contract', (t) => {
  const directory = workspace(t);
  const ticket = approveV2(directory);
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
  assert.equal(result.format, '2');
  assert.equal(result.change_identity, gitIdentity);
  assert.equal(result.state, 'draft');
  const report = fs.readFileSync(assessment, 'utf8');
  assert.match(report, /^contract_body_sha256: "[a-f0-9]{64}"$/m);
  assert.match(report, /^environment: "Node 24 on synthetic fixtures in a clean checkout"$/m);
  assert.match(report, /^assessor: "Independent Assessor"$/m);
});

test('completed assessment cannot claim pass without per-claim commands and observations', (t) => {
  const directory = workspace(t);
  const ticket = approveV2(directory);
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
- Contract method: EV1
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

test('completed pass/fail evidence must execute a contract method tied to the claim', (t) => {
  const directory = workspace(t);
  const ticket = approveV2(directory);
  const assessment = path.join(directory, 'assessment.md');
  scaffoldAssessment(ticket, assessment);
  makeAssessmentPass(assessment);
  replaceInFile(assessment, [['- Contract method: EV1', '- Contract method: EV2']]);

  const result = run(['assessment-complete', assessment], 1);
  assert.match(result.stderr, /references unknown contract evidence method\(s\): EV2/);
  assert.match(result.stderr, /must execute a referenced contract evidence method tied to the claim/);
});

test('all-pass assessment completes with evidence and a frozen report hash', (t) => {
  const directory = workspace(t);
  const ticket = approveV2(directory);
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
    const ticket = approveV2(directory);
    const assessment = path.join(directory, 'implementation.md');
    scaffoldAssessment(ticket, assessment);
    makeAssessmentFail(assessment, 'implementation-defect', remediationActions.implementation);
    run(['assessment-complete', assessment]);
  });

  await t.test('contract defect routes through revised approval', () => {
    const directory = workspace(t);
    const ticket = approveV2(directory);
    const assessment = path.join(directory, 'contract.md');
    scaffoldAssessment(ticket, assessment);
    makeAssessmentFail(assessment, 'contract-defect', remediationActions.contract);
    run(['assessment-complete', assessment]);
  });

  await t.test('insufficient evidence can complete as inconclusive', () => {
    const directory = workspace(t);
    const ticket = approveV2(directory);
    const assessment = path.join(directory, 'evidence.md');
    scaffoldAssessment(ticket, assessment);
    replaceInFile(assessment, [
      ['- Assessment is incomplete.', '- The relevant runtime was unavailable to the assessor.'],
    ]);
    run(['assessment-complete', assessment]);
  });

  await t.test('classification and action mismatch is rejected', () => {
    const directory = workspace(t);
    const ticket = approveV2(directory);
    const assessment = path.join(directory, 'mismatch.md');
    scaffoldAssessment(ticket, assessment);
    makeAssessmentFail(assessment, 'contract-defect', remediationActions.implementation);
    const result = run(['assessment-complete', assessment], 1);
    assert.match(result.stderr, /Remediation Next action must be/);
    assert.match(result.stderr, /derive a revised draft/);
  });
});

test('legacy assessment-v1 artifacts remain readable with an explicit warning', (t) => {
  const directory = workspace(t);
  const assessment = path.join(directory, 'legacy-assessment.md');
  fs.writeFileSync(assessment, `---
steward_assessment: "1"
contract_path: "ticket.md"
contract_id: "legacy"
contract_revision: 1
frozen_body_sha256: "${'b'.repeat(64)}"
change_ref: "working tree"
assessed_at: "2026-01-01T00:00:00.000Z"
state: draft
---
# Assessment: Legacy

## Overall

Outcome: inconclusive
`);
  const result = JSON.parse(run(['assessment-check', assessment, '--json']).stdout);
  assert.equal(result.valid, true);
  assert.equal(result.format, '1');
  assert.match(result.warnings[0], /lacks immutable change/);
  assert.match(run(['assessment-complete', assessment], 1).stderr, /cannot be completed/);
});
