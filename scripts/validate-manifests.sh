#!/usr/bin/env bash
# Validate plugin/marketplace manifests + skill name parity.
# Used by .github/workflows/validate.yml and .githooks/pre-push.
# Exits 0 on success, 1 on any validation failure.

set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

fail=0

# 1. JSON syntax across all plugin.json + marketplace.json
while IFS= read -r f; do
  if ! jq empty "$f" >/dev/null 2>&1; then
    echo "error: $f — invalid JSON" >&2
    fail=1
  fi
done < <(find . -path ./node_modules -prune -o -type f \( -name 'plugin.json' -o -name 'marketplace.json' \) -print)

# 2. Marketplace required fields
if ! jq -e '.name and .plugins and (.plugins | length > 0)' .claude-plugin/marketplace.json >/dev/null 2>&1; then
  echo "error: .claude-plugin/marketplace.json — missing name or plugins" >&2
  fail=1
fi
if ! jq -e '.name and .plugins and (.plugins | length > 0)' .agents/plugins/marketplace.json >/dev/null 2>&1; then
  echo "error: .agents/plugins/marketplace.json — missing name or plugins" >&2
  fail=1
fi

# 3. Version parity per plugin (claude vs codex manifests must match)
for dir in plugins/*/; do
  plugin=$(basename "$dir")
  claude_v=$(jq -r '.version' "$dir/.claude-plugin/plugin.json" 2>/dev/null || echo "")
  codex_v=$(jq -r '.version' "$dir/.codex-plugin/plugin.json" 2>/dev/null || echo "")
  if [ -z "$claude_v" ] || [ -z "$codex_v" ]; then
    echo "error: $plugin — missing manifest version (claude=$claude_v codex=$codex_v)" >&2
    fail=1
    continue
  fi
  if [ "$claude_v" != "$codex_v" ]; then
    echo "error: $plugin — claude=$claude_v codex=$codex_v — versions must match" >&2
    fail=1
  fi
done

# 4. Skill name matches directory
while IFS= read -r f; do
  dir=$(basename "$(dirname "$f")")
  name=$(awk '/^---/{c++; next} c==1 && /^name:/{print $2; exit}' "$f")
  if [ "$dir" != "$name" ]; then
    echo "error: $f — frontmatter name '$name' does not match directory '$dir'" >&2
    fail=1
  fi
done < <(find plugins -type f -name SKILL.md)

exit "$fail"
