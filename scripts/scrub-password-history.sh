#!/usr/bin/env bash
#
# Scrub a password literal from git history and force-push to origin/main.
#
# Usage:
#   SCRUB_PASSWORD='your-password-here' ./scripts/scrub-password-history.sh
#
# The script generates filter-repo patterns from the env var at runtime so the
# literal never lives in source. Patterns are narrow — only password contexts
# are touched (e.g. `?? 'pw'`, `APP_PASSWORD='pw'`, `authenticate('pw')`). Other
# uses of the word in unrelated contexts are left alone via more specific patterns.
#
# WARNING: destructive. Rewrites git history and force-pushes to origin/main.
# Anyone with the repo cloned will need to re-clone or hard-reset after this.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

if [[ -z "${SCRUB_PASSWORD:-}" ]]; then
  echo "ERROR: SCRUB_PASSWORD env var is required."
  echo "Usage: SCRUB_PASSWORD='your-password-here' $0"
  exit 1
fi

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "ERROR: git-filter-repo not installed. Run: brew install git-filter-repo"
  exit 1
fi

if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then
  echo "ERROR: must be on main branch, currently on $(git rev-parse --abbrev-ref HEAD)"
  exit 1
fi

REMOTE_URL="$(git remote get-url origin 2>/dev/null || echo '')"
if [[ -z "$REMOTE_URL" ]]; then
  REMOTE_URL='https://github.com/mrballistic-slalom/infocom-office-space.git'
  echo "No origin remote set; will use: $REMOTE_URL"
fi

PASS="$SCRUB_PASSWORD"
REDACTED='***REDACTED***'

PATTERNS_FILE="$(mktemp)"
MSG_PATTERNS_FILE="$(mktemp)"
trap 'rm -f "$PATTERNS_FILE" "$MSG_PATTERNS_FILE"' EXIT

# File-content replacements — narrow contexts only.
{
  printf '?? %q==>?? %q\n'                                "'$PASS'"               "'$REDACTED'"
  printf 'APP_PASSWORD=%q==>APP_PASSWORD=%q\n'            "'$PASS'"               "'$REDACTED'"
  printf 'APP_PASSWORD=%s==>APP_PASSWORD=%s\n'            "$PASS"                 "$REDACTED"
  printf 'APP_PASSWORD = %q==>APP_PASSWORD = %q\n'        "'$PASS'"               "'$REDACTED'"
  printf 'password: %q==>password: %q\n'                  "'$PASS'"               "'$REDACTED'"
  printf 'password:%q==>password:%q\n'                    "'$PASS'"               "'$REDACTED'"
  printf 'password: %q==>password: %q\n'                  "\"$PASS\""             "\"$REDACTED\""
  printf 'password:%q==>password:%q\n'                    "\"$PASS\""             "\"$REDACTED\""
  printf '%q==>%q\n'                                       "\"password\":\"$PASS\"" "\"password\":\"$REDACTED\""
  printf '%q==>%q\n'                                       "\"password\": \"$PASS\"" "\"password\": \"$REDACTED\""
  printf "setValue(%q)==>setValue(%q)\n"                   "'$PASS'"               "'$REDACTED'"
  printf 'authenticate(%q)==>authenticate(%q)\n'          "'$PASS'"               "'$REDACTED'"
  printf 'default %q==>default %q\n'                      "'$PASS'"               "'$REDACTED'"
  printf 'default %q==>default %q\n'                      "\`$PASS\`"             "\`$REDACTED\`"
  printf '(default %q)==>(default %q)\n'                  "'$PASS'"               "'$REDACTED'"
} > "$PATTERNS_FILE"

# Commit-message replacement. Word boundary keeps things like NPC ids intact.
printf 'regex:\\b%s\\b==>%s\n' "$PASS" "REDACTED" > "$MSG_PATTERNS_FILE"

BACKUP_BRANCH="backup-before-scrub-$(date +%s)"
git branch "$BACKUP_BRANCH" HEAD
echo "Local safety branch created: $BACKUP_BRANCH (delete with: git branch -D $BACKUP_BRANCH)"
echo

echo "Running git filter-repo..."
git filter-repo \
  --replace-text "$PATTERNS_FILE" \
  --replace-message "$MSG_PATTERNS_FILE" \
  --force

echo
echo "Re-adding origin remote (filter-repo strips it for safety)..."
git remote add origin "$REMOTE_URL" 2>/dev/null || git remote set-url origin "$REMOTE_URL"

echo
echo "Force-pushing main to origin..."
git push --force -u origin main

echo
echo "Done. Remaining matches for '$PASS' (intentional NPC/world refs are fine):"
echo "---"
grep -rn "$PASS" \
  --include="*.ts" --include="*.md" --include="*.vue" --include="*.yml" --include="*.json" \
  src cdk lambda tests .github README.md 2>/dev/null \
  || echo "(no remaining matches)"
