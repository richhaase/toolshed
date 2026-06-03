#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_SCRIPT="$SCRIPT_DIR/../../_shared/scripts/memento-root"
MEMENTO_ROOT="$("$ROOT_SCRIPT")"

cd "$MEMENTO_ROOT"

findings=0

# ---------------------------------------------------------------------------
# Scanner: fail CLOSED.
#
# Every privacy + integrity check below is only as trustworthy as the tool
# behind it. The previous implementation invoked `rg ... 2>/dev/null || true`,
# which on a box without ripgrep (a stripped-PATH cron / Routine, a fresh
# machine) silently matched nothing and reported a clean bill of health — a
# doctor that lies. Resolve ONE scanner up front; if none is available, REFUSE
# TO CERTIFY and exit non-zero rather than pretend everything is fine.
#
# Order: prefer `rg` (fast, .gitignore-aware), fall back to `grep -E`. Override
# with MEMENTO_DOCTOR_SCANNER=rg|grep (used for testing and to pin behavior on
# headless boxes). Scanner errors (exit > 1) abort the run instead of being
# swallowed into a false "clean".
# ---------------------------------------------------------------------------
SCANNER=""

_scanner_abort() {
  printf '# Memento Doctor\n\n'
  printf -- '- **P0 Scanner unavailable** — %s. Refusing to certify: the privacy and integrity checks cannot run, and a doctor that reports healthy without scanning is worse than no doctor.\n' "$1"
  exit 2
}

resolve_scanner() {
  local want="${MEMENTO_DOCTOR_SCANNER:-auto}"
  case "$want" in
    rg|grep)
      if command -v "$want" >/dev/null 2>&1; then SCANNER="$want"; return; fi
      _scanner_abort "requested scanner \`$want\` (MEMENTO_DOCTOR_SCANNER) is not on PATH" ;;
    auto)
      if command -v rg >/dev/null 2>&1; then SCANNER="rg"; return; fi
      if command -v grep >/dev/null 2>&1; then SCANNER="grep"; return; fi
      _scanner_abort "neither \`rg\` nor \`grep\` was found on PATH" ;;
    *)
      _scanner_abort "MEMENTO_DOCTOR_SCANNER must be 'rg' or 'grep' (got '$want')" ;;
  esac
}

# Thin engine selectors. Each preserves grep/rg's exit semantics verbatim:
#   0 = match found, 1 = no match (normal), >1 = real error (must NOT be ignored).
# grep recurses with -r and skips .git; rg recurses by default. Patterns are
# kept in a dialect valid for BOTH engines (hyphens last in classes, etc.).
scan_lines() {  # file:line:text
  local pat="$1"; shift
  if [ "$SCANNER" = "rg" ]; then rg -n -e "$pat" "$@"
  else grep -rEn --exclude-dir=.git -e "$pat" "$@"; fi
}
scan_oloc() {   # file:line:match (only the matched substring)
  local pat="$1"; shift
  if [ "$SCANNER" = "rg" ]; then rg -n -o -e "$pat" "$@"
  else grep -rEno --exclude-dir=.git -e "$pat" "$@"; fi
}
scan_omatch() { # matched substring only, no filename
  local pat="$1"; shift
  if [ "$SCANNER" = "rg" ]; then rg -o --no-filename -e "$pat" "$@"
  else grep -rEoh --exclude-dir=.git -e "$pat" "$@"; fi
}
scan_quiet() {  # exit status only
  local pat="$1"; shift
  if [ "$SCANNER" = "rg" ]; then rg -q -e "$pat" "$@"
  else grep -rEq --exclude-dir=.git -e "$pat" "$@"; fi
}

# Abort the whole run if a scan failed for a reason other than "no match".
scan_guard() {
  local rc="${1:-0}" ctx="${2:-scan}"
  if [ "$rc" -gt 1 ]; then
    emit P0 "Scanner error" "$ctx" "$SCANNER exited $rc — refusing to certify; results would be incomplete."
    printf '\nFindings: %s — ABORTED on scanner error.\n' "$findings"
    exit 3
  fi
}

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
  printf 'Root: `%s`\n' "$MEMENTO_ROOT"
  if [ "$SCANNER" = "rg" ]; then
    printf 'Scanner: `rg`\n'
  else
    printf 'Scanner: `grep -E` (degraded fallback — `rg` not in use; `.gitignore` not honored)\n'
  fi
  local scope
  scope="$(find wiki sources -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
  printf 'Scan scope: %s markdown file(s) under wiki/ + sources/\n\n' "${scope:-0}"
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

  local out rc=0
  out="$(scan_lines '^last_compiled:' wiki)" || rc=$?
  scan_guard "$rc" "check_compile_metadata"
  while IFS=: read -r file line _rest; do
    [ -n "${file:-}" ] || continue
    case "$file" in */INDEX.md|INDEX.md) continue ;; esac
    emit P2 "Page-level last_compiled" "$file:$line" "Freshness belongs in wiki/INDEX.md, not per-page frontmatter."
  done < <(printf '%s\n' "$out")
}

check_newer_sources() {
  have_file wiki/INDEX.md || return 0
  [ -d sources ] || return 0

  local count
  count="$(find sources -type f -name '*.md' -newer wiki/INDEX.md \
    ! -path 'sources/eval/*' \
    ! -path 'sources/trajectories/*' \
    | wc -l | tr -d ' ')"
  if [ "${count:-0}" -gt 0 ]; then
    local sample
    sample="$(find sources -type f -name '*.md' -newer wiki/INDEX.md \
      ! -path 'sources/eval/*' \
      ! -path 'sources/trajectories/*' \
      | sort | sed -n '1,8p' | awk '{ printf "%s%s", sep, $0; sep="; " }')"
    emit P1 "Active sources newer than wiki index" "wiki/INDEX.md" "$count public source file(s) are newer than the compiled index. Sample: $sample"
  fi
}

check_public_paths() {
  local search_roots=()
  for root in AGENTS.md CLAUDE.md GEMINI.md wiki; do
    [ -e "$root" ] && search_roots+=("$root")
  done
  [ "${#search_roots[@]}" -gt 0 ] || return 0

  local out rc=0
  out="$(scan_oloc '(sources|wiki|data|outputs)/[A-Za-z0-9._/-]+' "${search_roots[@]}")" || rc=$?
  scan_guard "$rc" "check_public_paths"
  while IFS=: read -r file line path; do
    [ -n "${path:-}" ] || continue
    case "$path" in
      *YYYY*|*...*|*/|outputs/*) continue ;;
    esac
    if [ ! -e "$path" ]; then
      emit P1 "Broken public evidence path" "$file:$line" "Referenced path does not exist: $path"
    fi
  done < <(printf '%s\n' "$out")
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
  done < <(find sources -type f -name '*.md' | sort)
}

check_trajectory_frontmatter() {
  [ -d sources/trajectories ] || return 0

  # Trajectories are telemetry: the learning loop queries the frontmatter, not the
  # prose. A record missing outcome/skills_used is invisible to that loop. (date is
  # already covered by check_source_frontmatter; sensitive-keyword leaks by
  # check_sensitive_route_mentions, which scans all of sources/.)
  while IFS= read -r traj; do
    if ! awk '
      NR == 1 && $0 == "---" { in_fm = 1; next }
      NR == 1 && $0 != "---" { exit 1 }
      in_fm && $0 == "---" { exit (outcome && skills) ? 0 : 1 }
      in_fm && /^outcome:[[:space:]]*[^[:space:]]/ { outcome = 1 }
      in_fm && /^skills_used:[[:space:]]*/ { skills = 1 }
      END { if (in_fm) exit (outcome && skills) ? 0 : 1 }
    ' "$traj"; then
      emit P2 "Trajectory missing telemetry frontmatter" "$traj" "Records need outcome + skills_used so the learning loop can query them. See the save/ama trajectory template."
    fi
  done < <(find sources/trajectories -type f -name '*.md' | sort)
}

check_wiki_frontmatter() {
  [ -d wiki ] || return 0

  while IFS= read -r page; do
    if ! awk '
      NR == 1 && $0 == "---" { in_fm = 1; next }
      NR == 1 && $0 != "---" { exit 1 }
      in_fm && $0 == "---" { exit found ? 0 : 1 }
      in_fm && /^type:[[:space:]]*[^[:space:]]/ { found = 1 }
      END { if (in_fm) exit found ? 0 : 1 }
    ' "$page"; then
      emit P2 "Wiki page missing type frontmatter" "$page" "Compiled wiki pages should carry a type field; missing it (or using a legacy key) is schema drift."
    fi
  done < <(find wiki -type f -name '*.md' ! -name 'INDEX.md' | sort)
}

check_hot_set_paths() {
  have_file AGENTS.md || return 0

  local out rc=0
  out="$(scan_oloc 'wiki/[A-Za-z0-9._/-]+\.md' AGENTS.md)" || rc=$?
  scan_guard "$rc" "check_hot_set_paths"
  while IFS=: read -r file line path; do
    [ -n "${path:-}" ] || continue
    if [ ! -f "$path" ]; then
      emit P1 "Broken hot-set wiki path" "$file:$line" "Referenced wiki page does not exist: $path"
    fi
  done < <(printf '%s\n' "$out")
}

check_wikilink_targets() {
  [ -d wiki ] || return 0

  local roots=()
  for root in AGENTS.md wiki; do
    [ -e "$root" ] && roots+=("$root")
  done
  [ "${#roots[@]}" -gt 0 ] || return 0

  # Slugs that a [[wikilink]] can resolve to: basenames of wiki pages.
  local slugs nl=$'\n'
  slugs="$(find wiki -type f -name '*.md' ! -name 'INDEX.md' -exec basename {} .md \; | sort -u)"

  # "not ] or |" must be spelled per-engine: rg (Rust) escapes the ]; POSIX ERE
  # (grep) treats a leading ] in the class as a literal. Same meaning, both faithful.
  local wl_pat
  if [ "$SCANNER" = "rg" ]; then wl_pat='\[\[[^\]|]+'; else wl_pat='\[\[[^]|]+'; fi

  local raw rc=0
  raw="$(scan_omatch "$wl_pat" "${roots[@]}")" || rc=$?
  scan_guard "$rc" "check_wikilink_targets"
  while IFS= read -r target; do
    [ -n "${target:-}" ] || continue
    case "$nl$slugs$nl" in
      *"$nl$target$nl"*) : ;;  # resolves to a real page
      *) emit P2 "Dangling wikilink target" "$target" "[[$target]] is referenced but no wiki page with that slug exists. May be rot or an intentional forward-reference." ;;
    esac
  done < <(printf '%s\n' "$raw" | sed 's/^\[\[[[:space:]]*//; s/[[:space:]]*$//' | sort -u)
}

check_public_private_refs() {
  local roots=()
  for root in wiki; do
    [ -d "$root" ] && roots+=("$root")
  done
  [ "${#roots[@]}" -gt 0 ] || return 0

  local out rc=0
  out="$(scan_lines 'private/' "${roots[@]}")" || rc=$?
  scan_guard "$rc" "check_public_private_refs"
  [ -n "$out" ] || return 0

  local count sample
  count="$(printf '%s\n' "$out" | wc -l | tr -d ' ')"
  sample="$(printf '%s\n' "$out" | cut -d: -f1,2 | sed -n '1,5p' | awk '{ printf "%s%s", sep, $0; sep="; " }')"
  emit P2 "Public wiki references private/" "wiki/" "$count wiki reference(s) to private/. Review whether they are structural policy references or content leaks. Sample: $sample"
}

check_sensitive_route_mentions() {
  local roots=()
  for root in sources wiki; do
    [ -d "$root" ] && roots+=("$root")
  done
  [ "${#roots[@]}" -gt 0 ] || return 0

  local out rc=0
  out="$(scan_lines 'chart-level|financial snapshot|account balance|medication|diagnosis specifics|mental health' "${roots[@]}")" || rc=$?
  scan_guard "$rc" "check_sensitive_route_mentions"
  while IFS=: read -r file line _rest; do
    [ -n "${file:-}" ] && [ -n "${line:-}" ] || continue
    emit P2 "Public source names sensitive routing" "$file:$line" "Sensitive-routing keyword found in public source. Inspect manually without echoing content."
  done < <(printf '%s\n' "$out" | sed -n '1,12p')
}

check_domain_store_mentions() {
  [ -d data ] || return 0
  have_file wiki/INDEX.md || return 0

  local qroots=()
  for r in wiki AGENTS.md plugins; do
    [ -e "$r" ] && qroots+=("$r")
  done
  [ "${#qroots[@]}" -gt 0 ] || return 0

  while IFS= read -r data_file; do
    local basename_no_ext rc=0
    basename_no_ext="$(basename "$data_file")"
    scan_quiet "$data_file|$basename_no_ext" "${qroots[@]}" >/dev/null 2>&1 || rc=$?
    scan_guard "$rc" "check_domain_store_mentions"
    if [ "$rc" -eq 1 ]; then
      emit P3 "Undocumented domain data file" "$data_file" "No public wiki/AGENTS/plugin mention found for this data file."
    fi
  done < <(find data -type f | sort)
}

check_vestigial_tasks_dir() {
  [ -d sources/tasks ] || return 0
  local count
  count="$(find sources/tasks -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
  emit P2 "Vestigial sources/tasks/ directory" "sources/tasks/" \
    "Memento no longer stores tasks (commitments belong in the issue tracker). $count file(s) inside. Remove the directory after triaging the contents."
}

check_followup_hygiene() {
  [ -d sources/followups ] || return 0
  local total
  total="$(find sources/followups -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
  [ "${total:-0}" -gt 0 ] || return 0

  if [ "$total" -gt 10 ]; then
    emit P2 "Follow-up queue is large" "sources/followups/" "$total open follow-ups. The queue is meant to be walkable in one sitting — consider /followups walk."
  fi

  local today
  today="$(date '+%Y-%m-%d')"
  local invalid=0
  local missing_expires=0
  local missing_rationale=0
  local expired=0
  while IFS= read -r f; do
    local schema
    schema="$(awk '
      NR == 1 && $0 == "---" { in_fm = 1; next }
      NR == 1 { bad = 1; exit }
      in_fm && $0 == "---" { closed = 1; exit }
      in_fm && /^expires_at:[[:space:]]*[0-9]{4}-[0-9]{2}-[0-9]{2}[[:space:]]*$/ { expires = 1 }
      in_fm && /^rationale:[[:space:]]*[^[:space:]]/ { rationale = 1 }
      END {
        if (bad || !in_fm || !closed) {
          print "invalid"
        } else {
          if (!expires) print "expires"
          if (!rationale) print "rationale"
        }
      }
    ' "$f")"

    case "$schema" in
      *invalid*)
        invalid=$((invalid + 1))
        continue
        ;;
    esac
    case "$schema" in
      *expires*) missing_expires=$((missing_expires + 1)) ;;
    esac
    case "$schema" in
      *rationale*) missing_rationale=$((missing_rationale + 1)) ;;
    esac
    case "$schema" in
      *expires*)
      continue
      ;;
    esac

    local exp
    exp="$(sed -n '/^---$/,/^---$/{s/^expires_at:[[:space:]]*\([0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]\).*/\1/p;}' "$f" 2>/dev/null | head -n 1)"
    if [ -n "$exp" ] && [ "$exp" \< "$today" ]; then
      expired=$((expired + 1))
    fi
  done < <(find sources/followups -type f -name '*.md' 2>/dev/null | sort)

  if [ "$invalid" -gt 0 ] || [ "$missing_expires" -gt 0 ] || [ "$missing_rationale" -gt 0 ]; then
    emit P3 "Follow-ups missing required frontmatter" "sources/followups/" "$invalid malformed item(s), $missing_expires missing expires_at, $missing_rationale missing rationale. Triage via /followups walk to bring them under the new bar."
  fi
  if [ "$expired" -gt 0 ]; then
    emit P2 "Expired follow-ups awaiting triage" "sources/followups/" "$expired item(s) past their expires_at — either dismiss or bump via /followups walk."
  fi
}

main() {
  resolve_scanner
  print_header
  check_required_files
  check_compile_metadata
  check_newer_sources
  check_public_paths
  check_source_frontmatter
  check_trajectory_frontmatter
  check_wiki_frontmatter
  check_hot_set_paths
  check_wikilink_targets
  check_public_private_refs
  check_sensitive_route_mentions
  check_domain_store_mentions
  check_vestigial_tasks_dir
  check_followup_hygiene

  if [ "$findings" -eq 0 ]; then
    printf 'No findings from deterministic checks.\n'
  else
    printf '\nFindings: %s\n' "$findings"
  fi
}

main "$@"
