# Memento directory layout

Read by `memento-config` Phase 1 before creating the base structure. The
`mkdir -p` command in `SKILL.md` is authoritative for what actually gets
created; this file records what each directory holds and why.

```
sources/                # L3 — raw inputs, cold storage
├── sessions/           # /save captures from conversations
├── syncs/              # Automated pulls from external services
│   └── <provider>/     # One dir per source (concept2/, github/, etc.)
├── notes/              # Durable knowledge — folds into wiki on /compile
├── followups/          # Small queue of "re-read within a week, act on it"
│                       # captures with expires_at frontmatter
├── trajectories/       # Session telemetry from /save and /ama. NOT compiled.
└── eval/               # Golden-query eval — NOT compiled (gate data + telemetry)
    ├── fixtures/       # regression.json + capability.json (drafted via /health-check eval)
    └── runs/           # <date>.jsonl — gate verdicts written by eval-score
wiki/                   # L2 — compiled knowledge, loaded on demand
outputs/                # Products of the system
├── surfaces/           # HTML dashboards, served over HTTP
└── reports/            # Generated briefings, analyses
private/                # Sensitive notes — never compiled into wiki
```

The Memento intentionally does not create `sources/tasks/`. Real commitments
belong in the user's issue tracker, not in markdown.

Empty directories are not Git artifacts. Only files actually written belong in
`MEMENTO_TOUCHED`.
