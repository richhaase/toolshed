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

domains() {
  awk '
    /^## / { active = ($0 == "## Domains"); next }
    active && /^- / { sub(/^- /, ""); print }
  ' "$grid"
}

out=$("$shell" "$roll")
check "roll prints five candidates by default" '[ "$(grep -c "^candidate [0-9][0-9]*: " <<< "$out")" -eq 5 ]'
check "default candidates are unique" '[ "$(sed "s/^candidate [0-9][0-9]*: //" <<< "$out" | sort -u | grep -c .)" -eq 5 ]'

all_ok=1
while IFS= read -r value; do
  grep -Fxq -- "$value" <(domains) || all_ok=0
done < <(sed 's/^candidate [0-9][0-9]*: //' <<< "$out")
check "every candidate is a domain prompt" '[ "$all_ok" -eq 1 ]'
check "roll emits no binding format, source, constraint, or opening" '! grep -Eq "^(mode|date|coordinates|integer|letter):|^  (format|seed|constraint|opening):" <<< "$out"'

three=$("$shell" "$roll" --count 3)
check "--count controls the number of candidates" '[ "$(grep -c "^candidate [0-9][0-9]*: " <<< "$three")" -eq 3 ]'

a=$(OSTRICH_SEED=4242 "$shell" "$roll")
b=$(OSTRICH_SEED=4242 "$shell" "$roll")
c=$(OSTRICH_SEED=4243 "$shell" "$roll")
check "OSTRICH_SEED makes a roll reproducible" '[ "$a" = "$b" ]'
check "a different seed changes the roll" '[ "$a" != "$c" ]'

total_domains=$(domains | grep -c .)
seen=$(for seed in $(seq 1 120); do OSTRICH_SEED=$seed "$shell" "$roll" --count 3; done | sed 's/^candidate [0-9][0-9]*: //' | sort -u | grep -c .)
check "360 draws cover at least 90% of $total_domains domains (saw $seen)" '[ $(( seen * 100 / total_domains )) -ge 90 ]'

check "--count rejects non-numbers" '! "$shell" "$roll" --count x >/dev/null 2>&1'
check "--count rejects more domains than exist" '! "$shell" "$roll" --count $(( total_domains + 1 )) >/dev/null 2>&1'
check "--grid rejects a missing file" '! "$shell" "$roll" --grid /nonexistent >/dev/null 2>&1'
check "--help exits 0" '"$shell" "$roll" --help >/dev/null'

echo "roll.test: $pass passed, $fail failed ($shell $("$shell" -c 'echo $BASH_VERSION'))"
[ "$fail" -eq 0 ]
