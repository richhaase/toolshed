#!/usr/bin/env bash
# Validate both marketplace surfaces, plugin manifests, and Agent Skills.
# With --base, also enforce plugin behavior change => manifest version bump.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/validate-manifests.sh [--base GIT_REF] [--target GIT_REF]

Run repository-wide static validation. When --base is supplied, every plugin
whose behavior changed between BASE and TARGET (default: HEAD) must bump both
harness manifest versions in lockstep. README and LICENSE-only plugin changes
do not require a bump.
EOF
}

base="${VALIDATION_BASE:-}"
target="${VALIDATION_TARGET:-HEAD}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      [[ $# -ge 2 ]] || { echo "error: --base requires a git ref" >&2; exit 2; }
      base=$2
      shift 2
      ;;
    --target)
      [[ $# -ge 2 ]] || { echo "error: --target requires a git ref" >&2; exit 2; }
      target=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command in git jq awk sed find sort cmp; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "error: required command not found: $command" >&2
    exit 2
  fi
done

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"
fail=0

error() {
  echo "error: $*" >&2
  fail=1
}

manifest_version_file() {
  jq -er '.version | select(type == "string" and length > 0)' "$1" 2>/dev/null || true
}

manifest_version_ref() {
  local ref=$1 path=$2
  git show "$ref:$path" 2>/dev/null | jq -er '.version | select(type == "string" and length > 0)' 2>/dev/null || true
}

# JSON syntax for every repository manifest.
while IFS= read -r file; do
  if ! jq empty "$file" >/dev/null 2>&1; then
    error "$file — invalid JSON"
  fi
done < <(find . -path ./.git -prune -o -path ./node_modules -prune -o \
  -type f \( -name plugin.json -o -name marketplace.json \) -print)

claude_market=.claude-plugin/marketplace.json
codex_market=.agents/plugins/marketplace.json

for market in "$claude_market" "$codex_market"; do
  if ! jq -e '
    (.name | type == "string" and length > 0) and
    (.plugins | type == "array" and length > 0) and
    (all(.plugins[];
      (.name | type == "string" and length > 0) and
      (.category | type == "string" and length > 0)))
  ' "$market" >/dev/null 2>&1; then
    error "$market — missing or invalid marketplace fields"
  fi
  if [[ $(jq -r '.plugins[].name' "$market" 2>/dev/null | sort | uniq -d) ]]; then
    error "$market — duplicate plugin name"
  fi
done

# The installable plugin set, category, and canonical local source must agree.
claude_names=$(jq -r '.plugins[].name' "$claude_market" 2>/dev/null | sort)
codex_names=$(jq -r '.plugins[].name' "$codex_market" 2>/dev/null | sort)
if [[ "$claude_names" != "$codex_names" ]]; then
  error "marketplaces — active plugin sets differ (claude: ${claude_names//$'\n'/, }; codex: ${codex_names//$'\n'/, })"
fi

while IFS= read -r plugin; do
  [[ -n "$plugin" ]] || continue
  expected="./plugins/$plugin"
  claude_source=$(jq -r --arg name "$plugin" '.plugins[] | select(.name == $name) | .source' "$claude_market")
  codex_source=$(jq -r --arg name "$plugin" '.plugins[] | select(.name == $name) | .source.path' "$codex_market")
  claude_category=$(jq -r --arg name "$plugin" '.plugins[] | select(.name == $name) | .category' "$claude_market")
  codex_category=$(jq -r --arg name "$plugin" '.plugins[] | select(.name == $name) | .category' "$codex_market")
  codex_source_kind=$(jq -r --arg name "$plugin" '.plugins[] | select(.name == $name) | .source.source' "$codex_market")

  [[ "$claude_source" == "$expected" ]] || error "$claude_market — $plugin source must be $expected"
  [[ "$codex_source" == "$expected" ]] || error "$codex_market — $plugin source path must be $expected"
  [[ "$codex_source_kind" == local ]] || error "$codex_market — $plugin source kind must be local"
  [[ "$claude_category" == "$codex_category" ]] || error "$plugin — marketplace categories differ"
  [[ -d "plugins/$plugin" ]] || error "$plugin — marketplace source directory does not exist"
done <<< "$claude_names"

# Every plugin directory has both manifests. Portable fields must remain equal;
# Codex-only interface metadata is the sole expected structural extension.
for dir in plugins/*/; do
  [[ -d "$dir" ]] || continue
  plugin=$(basename "$dir")
  claude_manifest="$dir.claude-plugin/plugin.json"
  codex_manifest="$dir.codex-plugin/plugin.json"

  if [[ ! -f "$claude_manifest" || ! -f "$codex_manifest" ]]; then
    error "$plugin — both Claude and Codex plugin manifests are required"
    continue
  fi

  for manifest in "$claude_manifest" "$codex_manifest"; do
    if ! jq -e --arg plugin "$plugin" '
      .name == $plugin and
      (.version | type == "string" and length > 0) and
      (.description | type == "string" and length > 0) and
      (.skills | type == "string" and length > 0)
    ' "$manifest" >/dev/null 2>&1; then
      error "$manifest — invalid required fields or name/directory mismatch"
    fi
  done

  claude_v=$(manifest_version_file "$claude_manifest")
  codex_v=$(manifest_version_file "$codex_manifest")
  if [[ -z "$claude_v" || -z "$codex_v" ]]; then
    error "$plugin — missing manifest version (claude=$claude_v codex=$codex_v)"
  elif [[ "$claude_v" != "$codex_v" ]]; then
    error "$plugin — claude=$claude_v codex=$codex_v; versions must match"
  fi

  claude_portable=$(jq -cS '.' "$claude_manifest" 2>/dev/null || true)
  codex_portable=$(jq -cS 'del(.interface)' "$codex_manifest" 2>/dev/null || true)
  if [[ "$claude_portable" != "$codex_portable" ]]; then
    error "$plugin — shared manifest fields differ between Claude and Codex"
  fi
done

# Validate Agent Skills frontmatter without introducing a YAML package runtime.
# This intentionally checks the portable basics; harness validators remain the
# authority for their additional metadata profiles.
while IFS= read -r file; do
  first=$(sed -n '1p' "$file")
  [[ "$first" == --- ]] || { error "$file — frontmatter must start on line 1"; continue; }
  close=$(awk 'NR > 1 && $0 == "---" { print NR; exit }' "$file")
  [[ -n "$close" ]] || { error "$file — missing closing frontmatter delimiter"; continue; }

  name_count=$(sed -n "2,$((close - 1))p" "$file" | awk '/^name:[[:space:]]*/ { count++ } END { print count+0 }')
  description_count=$(sed -n "2,$((close - 1))p" "$file" | awk '/^description:[[:space:]]*/ { count++ } END { print count+0 }')
  [[ "$name_count" -eq 1 ]] || error "$file — frontmatter requires exactly one top-level name"
  [[ "$description_count" -eq 1 ]] || error "$file — frontmatter requires exactly one top-level description"

  name=$(sed -n "2,$((close - 1))p" "$file" | awk '/^name:[[:space:]]*/ { sub(/^name:[[:space:]]*/, ""); print; exit }' | tr -d "\"'")
  directory=$(basename "$(dirname "$file")")
  if [[ ! "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ || ${#name} -gt 64 ]]; then
    error "$file — name must be 1-64 lowercase letters/numbers separated by single hyphens"
  elif [[ "$directory" != "$name" ]]; then
    error "$file — frontmatter name '$name' does not match directory '$directory'"
  fi

  description=$(sed -n "2,$((close - 1))p" "$file" | awk '
    /^description:[[:space:]]*/ {
      active=1
      line=$0
      sub(/^description:[[:space:]]*/, "", line)
      if (line !~ /^[>|][-+0-9]*[[:space:]]*$/) print line
      next
    }
    active && /^[^[:space:]][^:]*:/ { exit }
    active && /^[[:space:]]+/ { sub(/^[[:space:]]+/, ""); print }
  ')
  description_compact=$(printf '%s' "$description" | tr -d '[:space:]')
  if [[ -z "$description_compact" || ${#description} -gt 1024 ]]; then
    error "$file — description must contain 1-1024 characters"
  fi

  if ! awk -v delimiter_line="$close" 'NR > delimiter_line && /[^[:space:]]/ { found=1; exit } END { if (!found) exit 1 }' "$file"; then
    error "$file — skill body is empty"
  fi
done < <(find plugins .agents/skills .claude/skills -type f -name SKILL.md 2>/dev/null | sort)

refresh_agents_dir=.agents/skills/refresh-actuary-criteria
refresh_claude_link=.claude/skills/refresh-actuary-criteria
if [[ ! -f "$refresh_agents_dir/SKILL.md" || -L "$refresh_agents_dir" ]]; then
  error "refresh-actuary-criteria — canonical .agents skill is required as a regular file"
elif [[ ! -L "$refresh_claude_link" ]]; then
  error "refresh-actuary-criteria — .claude entry must be a symlink to the canonical .agents skill"
elif [[ "$(readlink -f "$refresh_claude_link")" != "$(readlink -f "$refresh_agents_dir")" ]]; then
  error "refresh-actuary-criteria — .claude symlink does not resolve to the .agents skill"
fi

# Harness-neutral eval data is release evidence. Keep its small schemas valid so
# later runners can consume it without discovering malformed fixtures at runtime.
actuary_evals=plugins/actuary/skills/skill-audit/evals/evals.json
if [[ -f "$actuary_evals" ]] && ! jq -e '
  .skill_name == "skill-audit" and
  (.evals | type == "array" and length >= 3) and
  all(.evals[];
    (.id | type == "number") and
    (.prompt | type == "string" and length > 0) and
    (.expected_output | type == "string" and length > 0) and
    (.assertions | type == "array" and length > 0))
' "$actuary_evals" >/dev/null 2>&1; then
  error "$actuary_evals — invalid behavioral eval fixture schema"
fi

while IFS= read -r file; do
  if ! jq -e '
    type == "array" and length == 20 and
    (map(select(.should_trigger == true)) | length) == 10 and
    (map(select(.should_trigger == false)) | length) == 10 and
    (map(.query) | unique | length) == 20 and
    all(.[];
      (.query | type == "string" and length > 0) and
      (.should_trigger | type == "boolean"))
  ' "$file" >/dev/null 2>&1; then
    error "$file — trigger evals require 20 unique queries split 10 true / 10 false"
  fi
done < <(find plugins -path '*/evals/trigger-queries.json' -type f | sort)

# Optional historical gate: behavior changes require both cache-key versions to
# differ from the supplied base. New and deleted plugins are handled by the
# marketplace/orphan checks rather than inventing a predecessor version.
if [[ -n "$base" ]]; then
  if ! base_commit=$(git rev-parse --verify "$base^{commit}" 2>/dev/null); then
    echo "error: --base is not a commit: $base" >&2
    exit 2
  fi
  if ! target_commit=$(git rev-parse --verify "$target^{commit}" 2>/dev/null); then
    echo "error: --target is not a commit: $target" >&2
    exit 2
  fi

  changed_plugins=$(
    git diff --name-only "$base_commit" "$target_commit" -- plugins/ |
      awk -F/ '
        NF >= 3 && $3 != ".claude-plugin" && $3 != ".codex-plugin" &&
        $3 != "README.md" && $3 != "LICENSE" { print $2 }
      ' | sort -u
  )

  while IFS= read -r plugin; do
    [[ -n "$plugin" ]] || continue
    claude_path="plugins/$plugin/.claude-plugin/plugin.json"
    codex_path="plugins/$plugin/.codex-plugin/plugin.json"
    base_claude=$(manifest_version_ref "$base_commit" "$claude_path")
    base_codex=$(manifest_version_ref "$base_commit" "$codex_path")
    target_claude=$(manifest_version_ref "$target_commit" "$claude_path")
    target_codex=$(manifest_version_ref "$target_commit" "$codex_path")

    # New/deleted plugins do not have a comparable two-sided cache key.
    [[ -n "$base_claude" && -n "$base_codex" && -n "$target_claude" && -n "$target_codex" ]] || continue
    if [[ "$target_claude" != "$target_codex" ]]; then
      error "$plugin — target manifest versions differ ($target_claude vs $target_codex)"
    elif [[ "$target_claude" == "$base_claude" || "$target_codex" == "$base_codex" ]]; then
      error "$plugin — behavior changed between $base_commit and $target_commit but version stayed $target_claude"
    fi
  done <<< "$changed_plugins"
fi

if [[ "$fail" -eq 0 ]]; then
  echo "validate-manifests: OK"
fi
exit "$fail"
