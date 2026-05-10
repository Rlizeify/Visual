#!/bin/bash
# Vercel Link Guard
# Ensures the repo is linked to project-iwmob (mheu.lol), not the old 'web' project.
# Run before deploys or as part of pre-commit hook.
#
# Expected projectId: prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR (project-iwmob)
# Team: rlizeifys-projects
# Domain: mheu.lol

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
PROJECT_JSON="$REPO_ROOT/.vercel/project.json"
EXPECTED_PROJECT_ID="prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR"
EXPECTED_PROJECT_NAME="project-iwmob"

# Check root .vercel/project.json exists
if [ ! -f "$PROJECT_JSON" ]; then
  echo "ERROR: $PROJECT_JSON not found."
  echo "Run 'npx vercel link' from repo root and select project-iwmob."
  exit 1
fi

# Extract projectId
ACTUAL_ID=$(grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_JSON" | sed 's/.*"\([^"]*\)"$/\1/')
ACTUAL_NAME=$(grep -o '"projectName"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_JSON" | sed 's/.*"\([^"]*\)"$/\1/')

if [ "$ACTUAL_ID" != "$EXPECTED_PROJECT_ID" ]; then
  echo "ERROR: Vercel link has drifted!"
  echo "  Expected: $EXPECTED_PROJECT_NAME ($EXPECTED_PROJECT_ID)"
  echo "  Actual:   $ACTUAL_NAME ($ACTUAL_ID)"
  echo ""
  echo "Fix: Delete .vercel/ and run 'npx vercel link' from repo root."
  echo "     Select project-iwmob under team rlizeifys-projects."
  exit 1
fi

# Check for rogue web/.vercel directory
if [ -d "$REPO_ROOT/web/.vercel" ]; then
  echo "ERROR: Found web/.vercel directory - this causes deploy drift!"
  echo "Fix: rm -rf web/.vercel"
  exit 1
fi

echo "OK: Vercel linked to $ACTUAL_NAME ($ACTUAL_ID)"
exit 0
