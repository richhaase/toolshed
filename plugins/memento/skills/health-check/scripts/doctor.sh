#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_SCRIPT="$SCRIPT_DIR/../../_shared/scripts/memento-root"
MEMENTO_ROOT="$("$ROOT_SCRIPT")"

cd "$MEMENTO_ROOT"

findings=0

emit() {
  local severity="$1"
  local title="$2"
  local target="${3:-}"
  local detail="${4:-}"

  findings=$((findings + 1))
  if [ -n "$target" ]; then
    printf -- '- **%s %s** — `%s`' "$severity" "$title" "$target"
  else
    printf -- '- **%s %s**' "$severity" "$title"
  fi
  if [ -n "$detail" ]; then
    printf ': %s' "$detail"
  fi
  printf '\n'
}

have_file() {
  [ -f "$1" ]
}

print_header() {
  printf '# Memento Doctor\n\n'
  printf 'Root: `%s`\n\n' "$MEMENTO_ROOT"
}

check_required_files() {
  have_file AGENTS.md || emit P1 "Missing canonical AGENTS.md" "AGENTS.md" "Memento should have a shared agent entrypoint."
  have_file wiki/INDEX.md || emit P1 "Missing wiki index" "wiki/INDEX.md" "Compile output index is absent."
}

check_compile_metadata() {
  [ -d .git ] || return 0
  have_file wiki/INDEX.md || return 0

  if ! awk '
    NR == 1 && $0 == "---" { in_fm = 1; next }
    in_fm && $0 == "---" { exit }
    in_fm && /^last_compile_commit:[[:space:]]*[0-9a-f]{40}[[:space:]]*$/ { found = 1 }
    END { exit found ? 0 : 1 }
  ' wiki/INDEX.md; then
    emit P1 "Missing last_compile_commit" "wiki/INDEX.md" "Git-backed Mementos need this for reliable incremental compile scope."
  fi

  while IFS= read -r hit; do
    emit P2 "Page-level last_compiled" "$hit" "Freshness belongs in wiki/INDEX.md, not per-page frontmatter."
  done < <(rg -n '^last_compiled:' wiki --glob '*.md' --glob '!INDEX.md' 2>/dev/null || true)
}

check_newer_sources() {
  have_file wiki/INDEX.md || return 0
  [ -d sources ] || return 0

  local count
  count="$(find sources -type f -name '*.md' ! -path 'sources/tasks/done/*' -newer wiki/INDEX.md | wc -l | tr -d ' ')"
  if [ "${count:-0}" -gt 0 ]; then
    local sample
    sample="$(find sources -type f -name '*.md' ! -path 'sources/tasks/done/*' -newer wiki/INDEX.md | sort | sed -n '1,8p' | awk '{ printf "%s%s", sep, $0; sep="; " }')"
    emit P1 "Active sources newer than wiki index" "wiki/INDEX.md" "$count public source file(s) are newer than the compiled index. Sample: $sample"
  fi
}

check_public_paths() {
  local search_roots=()
  for root in AGENTS.md CLAUDE.md GEMINI.md wiki; do
    [ -e "$root" ] && search_roots+=("$root")
  done
  [ "${#search_roots[@]}" -gt 0 ] || return 0

  while IFS=: read -r file line path; do
    [ -n "${path:-}" ] || continue
    case "$path" in
      *YYYY*|*...*|*/|outputs/*) continue ;;
    esac
    if [ ! -e "$path" ]; then
      emit P1 "Broken public evidence path" "$file:$line" "Referenced path does not exist: $path"
    fi
  done < <(rg -n -o '(sources|wiki|data|outputs)/[A-Za-z0-9._/\-]+' "${search_roots[@]}" 2>/dev/null || true)
}

check_source_frontmatter() {
  [ -d sources ] || return 0

  while IFS= read -r source; do
    if ! awk '
      NR == 1 && $0 == "---" { in_fm = 1; next }
      NR == 1 && $0 != "---" { exit 1 }
      in_fm && $0 == "---" { exit found ? 0 : 1 }
      in_fm && /^date:[[:space:]]*/ { found = 1 }
      END { if (in_fm) exit found ? 0 : 1 }
    ' "$source"; then
      emit P2 "Source missing date frontmatter" "$source" "Markdown sources need frontmatter with at least date."
    fi
  done < <(find sources -type f -name '*.md' ! -path 'sources/tasks/done/*' | sort)
}

check_hot_set_paths() {
  have_file AGENTS.md || return 0

  while IFS=: read -r file line path; do
    [ -n "${path:-}" ] || continue
    if [ ! -f "$path" ]; then
      emit P1 "Broken hot-set wiki path" "$file:$line" "Referenced wiki page does not exist: $path"
    fi
  done < <(rg -n -o 'wiki/[A-Za-z0-9._/\-]+\.md' AGENTS.md 2>/dev/null || true)
}

check_public_private_refs() {
  local roots=()
  for root in wiki; do
    [ -d "$root" ] && roots+=("$root")
  done
  [ "${#roots[@]}" -gt 0 ] || return 0

  local count
  count="$(rg -n 'private/' "${roots[@]}" 2>/dev/null | wc -l | tr -d ' ')"
  [ "${count:-0}" -gt 0 ] || return 0

  local sample
  sample="$(rg -n 'private/' "${roots[@]}" 2>/dev/null | cut -d: -f1,2 | sed -n '1,5p' | awk '{ printf "%s%s", sep, $0; sep="; " }')"
  emit P2 "Public wiki references private/" "wiki/" "$count wiki reference(s) to private/. Review whether they are structural policy references or content leaks. Sample: $sample"
}

check_sensitive_route_mentions() {
  local roots=()
  for root in sources wiki; do
    [ -d "$root" ] && roots+=("$root")
  done
  [ "${#roots[@]}" -gt 0 ] || return 0

  while IFS=: read -r file line _rest; do
    [ -n "${file:-}" ] && [ -n "${line:-}" ] || continue
    emit P2 "Public source names sensitive routing" "$file:$line" "Sensitive-routing keyword found in public source. Inspect manually without echoing content."
  done < <(rg -n 'chart-level|financial snapshot|account balance|medication|diagnosis specifics|mental health' "${roots[@]}" --glob '!sources/tasks/done/**' 2>/dev/null | sed -n '1,12p' || true)
}

check_domain_store_mentions() {
  [ -d data ] || return 0
  have_file wiki/INDEX.md || return 0

  while IFS= read -r data_file; do
    local basename_no_ext
    basename_no_ext="$(basename "$data_file")"
    if ! rg -q "$data_file|$basename_no_ext" wiki AGENTS.md plugins 2>/dev/null; then
      emit P3 "Undocumented domain data file" "$data_file" "No public wiki/AGENTS/plugin mention found for this data file."
    fi
  done < <(find data -type f | sort)
}

main() {
  print_header
  check_required_files
  check_compile_metadata
  check_newer_sources
  check_public_paths
  check_source_frontmatter
  check_hot_set_paths
  check_public_private_refs
  check_sensitive_route_mentions
  check_domain_store_mentions

  if [ "$findings" -eq 0 ]; then
    printf 'No findings from deterministic checks.\n'
  else
    printf '\nFindings: %s\n' "$findings"
  fi
}

main "$@"
