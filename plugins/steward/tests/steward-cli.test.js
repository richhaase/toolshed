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
  run(['create', ticket, '--id', 'greeting', '--title', 'Add greeting option']);
  makeV2Ready(ticket);
  return ticket;
}

function approveV2(directory, name = 'greeting.r1.md') {
  const ticket = createReadyV2(directory, name);
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

test('shipped format-v2 example remains structurally valid', () => {
  const result = JSON.parse(run(['check', exampleContract, '--json']).stdout);
  assert.equal(result.valid, true);
  assert.equal(result.format, '2');
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
