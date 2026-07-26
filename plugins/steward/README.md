# Steward — Intent and assurance contracts

Steward separates the outer intent-and-assurance loop from software
construction. A portable Markdown ticket is the entire interface to an
interchangeable builder:

1. `frame` drafts and, after explicit user approval, freezes the contract.
2. `critique` independently challenges the proposed contract.
3. Any builder reads the approved ticket in its codebase and builds.
4. `assess` independently judges the completed change claim by claim.

Steward v1 stores no centralized state and has no builder adapter. Contract
files may live anywhere a local path can address them.

## Runtime

The bundled CLI requires Node.js and has no third-party dependencies:

```bash
node resources/scripts/steward --help
```

It creates and verifies contract revisions, freezes explicit approvals,
compares revisions, and creates assessment scaffolds. See
`resources/references/contract-format.md` for the portable format and
lifecycle.

Run its tests with:

```bash
node --test tests/steward-cli.test.js
```
