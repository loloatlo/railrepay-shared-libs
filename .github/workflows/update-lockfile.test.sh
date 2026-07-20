#!/usr/bin/env bash
# =============================================================================
# BL-391 Slice 1 — static assertions for update-lockfile.yml
# =============================================================================
# TD-1 (Jessie — RED). Permanent regression net for the shared-libs
# update-lockfile workflow's SOP-012 gate. Plain bash + grep only (no npm, no
# yq). Git Bash / any POSIX bash runs it.
#
# Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify this script. Rework
# update-lockfile.yml (TD-2 GREEN) until every assertion passes. Hand back with
# explanation if an assertion looks wrong.
#
# Usage:  ./update-lockfile.test.sh [path-to-update-lockfile.yml]
#         (defaults to the sibling update-lockfile.yml)
#
# WHY (BL-379 AC-4 canary find, recorded on BL-391):
#   1. gitleaks' default ruleset path-allowlists lock files, so a credential in
#      package-lock.json is NEVER detected by the plain gitleaks-action step
#      (live false-negative specimen: run 29725952797 — planted AWS key in
#      package-lock.json scanned GREEN). The identical key in a non-lockfile
#      name goes RED (run 29726177651, foo-diag.json) — the fix is to copy the
#      lockfile to a NON-allowlisted temp name and scan that with --no-git.
#   2. The existing L1 step runs AFTER commit+push, so it detects post-push
#      instead of blocking the push.
#
# Normative fix shape under test (Quinn TD-0, BL-391 Slice 1):
#   regenerate -> git commit (LOCAL, no push) -> commit-scan (existing L1
#   gitleaks-action, default config) -> NEW lockfile-scan (copy package-lock.json
#   to $RUNNER_TEMP/<non-lockfile-name>, pinned+sha256-verified gitleaks
#   `detect --no-git` over the copy, fail on hit) -> push ONLY if both scans green.
#
# RED expectation: FAILS against the current workflow (push is pre-scan; no
# lockfile-scan; no pinned+sha256 binary). GREEN expectation: exits 0 once TD-2
# lands the reworked workflow.
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WF="${1:-$SCRIPT_DIR/update-lockfile.yml}"

if [ ! -f "$WF" ]; then
  echo "ERROR: workflow not found: $WF" >&2
  exit 2
fi

pass=0
fail=0
ok()  { printf '  PASS  %s\n' "$1"; pass=$((pass + 1)); }
bad() { printf '  FAIL  %s\n' "$1"; fail=$((fail + 1)); }

assert_hasF()    { if grep -qF -e "$2" "$WF"; then ok "$1"; else bad "$1"; fi; }
assert_hasE()    { if grep -qE -e "$2" "$WF"; then ok "$1"; else bad "$1"; fi; }
assert_absentE() { if grep -qE -e "$2" "$WF"; then bad "$1"; else ok "$1"; fi; }

# first matching line number for a regex, or empty
line_of() { grep -nE -m1 -e "$1" "$WF" 2>/dev/null | cut -d: -f1; }

# assert $2 (later anchor line) exists and is strictly AFTER $3 (earlier line)
assert_after() {
  local desc="$1" later="$2" earlier="$3"
  if [ -n "$later" ] && [ -n "$earlier" ] && [ "$later" -gt "$earlier" ]; then
    ok "$desc"
  else
    bad "$desc (later=${later:-<absent>} earlier=${earlier:-<absent>})"
  fi
}

echo "BL-391 update-lockfile.yml assertions"
echo "WORKFLOW: $WF"
echo

echo "[ Regression guards — these must remain ]"
assert_hasF "REG: workflow name 'update-lockfile'"        "name: update-lockfile"
assert_hasF "REG: workflow_dispatch trigger"              "workflow_dispatch:"
assert_hasF "REG: regenerate lockfile (npm install)"      "npm install"
assert_hasF "REG: git commit present"                     "git commit"
assert_hasF "REG: git push present"                       "git push"
assert_hasF "REG: commit-scan retained (gitleaks-action@v2)" "gitleaks/gitleaks-action@v2"

echo
echo "[ AC-a — targeted lockfile scan (dodges the filename allowlist) ]"
assert_hasF "AC-a: out-of-tree copy uses \$RUNNER_TEMP"   "RUNNER_TEMP"
assert_hasF "AC-a: copies package-lock.json for scanning" "package-lock.json"
assert_hasF "AC-a: 'gitleaks detect' CLI over the copy"   "gitleaks detect"
assert_hasF "AC-a: scans with --no-git (file, not history)" "--no-git"
assert_absentE "AC-a: temp copy is NOT named package-lock.json (else still allowlisted)" \
  "RUNNER_TEMP[^\"' ]*package-lock"

echo
echo "[ AC-a — pinned + sha256-verified gitleaks binary (BL-377 pattern) ]"
assert_hasF "AC-a: pinned binary from releases/download/"  "releases/download/"
assert_hasE "AC-a: pinned semantic version (x.y.z)"        "[0-9]+\.[0-9]+\.[0-9]+"
assert_hasF "AC-a: sha256sum checksum verification"        "sha256sum"

echo
echo "[ AC-b — commit LOCAL, scans BEFORE push, push only if green ]"
push_line=$(line_of 'git push')
commit_scan_line=$(line_of 'gitleaks/gitleaks-action@v2')
lockfile_scan_line=$(line_of '\-\-no-git')
assert_after "AC-b: push is AFTER the commit-scan (gitleaks-action)" "$push_line" "$commit_scan_line"
assert_after "AC-b: push is AFTER the lockfile-scan (--no-git)"      "$push_line" "$lockfile_scan_line"

echo
printf 'RESULT: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
