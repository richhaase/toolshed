#!/usr/bin/env bash
set -eu

here=$(cd "$(dirname "$0")" && pwd)
roll="$here/../skills/ostrich/scripts/roll"
grid="$here/../skills/ostrich/references/tangent-grid.md"
shell=${ROLL_TEST_SHELL:-bash}
pass=0
fail=0

ok() { pass=$(( pass + 1 )); echo "  PASS  $1"; }
bad() { fail=$(( fail + 1 )); echo "  FAIL  $1"; }
check() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

section() {
  awk -v s="$1" '
    /^## / { active = ($0 == "## " s); next }
    active && /^- / { sub(/^- /, ""); print }
  ' "$grid"
}

field() { awk -v k="$2" '$0 ~ "^  " k ": " { sub("^  " k ": ", ""); print }' <<< "$1"; }

out=$("$shell" "$roll")
check "roll exits 0 and prints a mode" 'grep -q "^mode: \(explore\|exploit\)$" <<< "$out"'
check "roll prints a date between 1770 and 1963" 'grep -q "^date: 1[789][0-9][0-9]-[01][0-9]-[0-3][0-9]$" <<< "$out"'
check "roll prints a recent date from 1996 on" 'grep -q "^recent-date: \(199[6-9]\|20[0-9][0-9]\)-[01][0-9]-[0-3][0-9]$" <<< "$out"'
check "roll prints signed decimal coordinates" 'grep -q "^coordinates: -\?[0-9]\{1,2\}\.[0-9]\{4\}, -\?[0-9]\{1,3\}\.[0-9]\{4\}$" <<< "$out"'
check "roll prints an integer from 1 to 100" 'n=$(sed -n "s/^integer: //p" <<< "$out"); [ "$n" -ge 1 ] && [ "$n" -le 100 ]'
check "roll prints one capital letter" 'grep -q "^letter: [A-Z]$" <<< "$out"'
check "roll prints three candidates by default" '[ "$(grep -c "^candidate [0-9]*:$" <<< "$out")" -eq 3 ]'

for dim in Domains Formats Constraints Seeds Openings; do
  key=$(tr '[:upper:]' '[:lower:]' <<< "${dim%s}")
  values=$(field "$out" "$key")
  all_ok=1
  while IFS= read -r v; do
    grep -Fxq -- "$v" <(section "$dim") || all_ok=0
  done <<< "$values"
  check "every rolled $key is a grid entry" '[ "$all_ok" -eq 1 ]'
done

five=$("$shell" "$roll" --count 5)
check "--count controls the number of candidates" '[ "$(grep -c "^candidate [0-9]*:$" <<< "$five")" -eq 5 ]'

a=$(OSTRICH_SEED=4242 "$shell" "$roll")
b=$(OSTRICH_SEED=4242 "$shell" "$roll")
c=$(OSTRICH_SEED=4243 "$shell" "$roll")
check "OSTRICH_SEED makes a roll reproducible" '[ "$a" = "$b" ]'
check "a different seed changes the roll" '[ "$a" != "$c" ]'

total_domains=$(section Domains | grep -c .)
seen=$(for s in $(seq 1 120); do OSTRICH_SEED=$s "$shell" "$roll" --count 3; done | awk '/^  domain: / { sub("^  domain: ", ""); print }' | sort -u | grep -c .)
check "360 draws cover at least 90% of $total_domains domains (saw $seen)" '[ $(( seen * 100 / total_domains )) -ge 90 ]'

explores=$(for s in $(seq 1 200); do OSTRICH_SEED=$s "$shell" "$roll" --count 1; done | grep -c "^mode: explore$")
check "explore mode lands between 60% and 90% of 200 rolls (saw $explores)" '[ "$explores" -ge 120 ] && [ "$explores" -le 180 ]'

check "--count rejects non-numbers" '! "$shell" "$roll" --count x >/dev/null 2>&1'
check "--grid rejects a missing file" '! "$shell" "$roll" --grid /nonexistent >/dev/null 2>&1'
check "--help exits 0" '"$shell" "$roll" --help >/dev/null'

echo "roll.test: $pass passed, $fail failed ($shell $("$shell" -c 'echo $BASH_VERSION'))"
[ "$fail" -eq 0 ]
