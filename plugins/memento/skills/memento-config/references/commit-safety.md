# Exact-path commit safety

Use this flow for every `memento-config` write. It prevents configuration work
from sweeping unrelated staged, modified, or untracked files into its commit.

## Before writing

Initialize Git if needed, then require an empty index:

```bash
git -C "$MEMENTO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || git -C "$MEMENTO_ROOT" init

if ! git -C "$MEMENTO_ROOT" diff --cached --quiet; then
  echo "memento-config: staged changes already exist; commit or unstage them first" >&2
  exit 1
fi

MEMENTO_TOUCHED=()
```

Immediately before each Write or Edit, compute its path relative to
`MEMENTO_ROOT`. If an existing intended path is already dirty, stop rather than
combining the user's earlier edit with this run:

```bash
rel="AGENTS.md" # replace with the exact intended path
if [[ -e "$MEMENTO_ROOT/$rel" ]] \
   && [[ -n "$(git -C "$MEMENTO_ROOT" status --porcelain -- "$rel")" ]]; then
  echo "memento-config: intended path is already dirty: $rel" >&2
  exit 1
fi
MEMENTO_TOUCHED+=("$rel")
```

Do this once per intended file. Do not add directories merely created with
`mkdir -p`; Git does not track empty directories. Do not add an optional project
repo's `.memento-root` pointer to the Memento repo's list—it belongs to its own
repository and confirmation boundary.

## Stage and verify

If the list is empty, skip the commit. Otherwise stage exactly those files:

```bash
if [[ ${#MEMENTO_TOUCHED[@]} -eq 0 ]]; then
  echo "commit: skipped (no files written)"
  exit 0
fi

git -C "$MEMENTO_ROOT" add -- "${MEMENTO_TOUCHED[@]}"
```

Then verify that every staged path is in the touched list and that no deletion
was staged. This second check catches path-list mistakes before they become a
commit:

```bash
staged="$(git -C "$MEMENTO_ROOT" diff --cached --name-only)"
invalid=""
while IFS= read -r path; do
  [[ -n "$path" ]] || continue
  allowed=false
  for expected in "${MEMENTO_TOUCHED[@]}"; do
    if [[ "$path" == "$expected" ]]; then
      allowed=true
      break
    fi
  done
  if [[ "$allowed" != true ]]; then
    invalid+="${invalid:+, }$path"
  fi
done <<< "$staged"

if [[ -n "$invalid" ]]; then
  echo "memento-config: refusing commit; unexpected staged paths: $invalid" >&2
  exit 1
fi
if [[ -n "$(git -C "$MEMENTO_ROOT" diff --cached --name-only --diff-filter=D)" ]]; then
  echo "memento-config: refusing commit; configuration must not stage deletions" >&2
  exit 1
fi
if git -C "$MEMENTO_ROOT" diff --cached --quiet; then
  echo "commit: skipped (no changes)"
  exit 0
fi
```

Only after these checks should the skill create its local commit. Never push and
never amend.
