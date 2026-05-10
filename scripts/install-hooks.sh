#!/bin/bash
# Install git pre-commit hook for secret scanning + Vercel link guard
# Run: bash scripts/install-hooks.sh

HOOK_DIR="$(git rev-parse --git-dir)/hooks"
HOOK_FILE="$HOOK_DIR/pre-commit"

cat > "$HOOK_FILE" << 'HOOK_CONTENT'
#!/bin/bash
# Pre-commit hook:
# 1. Vercel link guard (prevent deploy drift to wrong project)
# 2. Secret scanning (JWTs, AWS keys, API keys, private keys, tokens, passwords)

set -e

# --- Vercel Link Guard ---
REPO_ROOT="$(git rev-parse --show-toplevel)"
EXPECTED_PROJECT_ID="prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR"

# Check for rogue web/.vercel directory
if [ -d "$REPO_ROOT/web/.vercel" ]; then
  echo "BLOCKED: Found web/.vercel directory - this causes deploy drift!"
  echo "Fix: rm -rf web/.vercel"
  echo "Always deploy from repo root, never from /web."
  exit 1
fi

# Verify root .vercel/project.json points to project-iwmob
if [ -f "$REPO_ROOT/.vercel/project.json" ]; then
  ACTUAL_ID=$(grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' "$REPO_ROOT/.vercel/project.json" | sed 's/.*"\([^"]*\)"$/\1/')
  if [ "$ACTUAL_ID" != "$EXPECTED_PROJECT_ID" ]; then
    echo "BLOCKED: Vercel link has drifted!"
    echo "  Expected: project-iwmob ($EXPECTED_PROJECT_ID)"
    echo "  Actual:   $ACTUAL_ID"
    echo "Fix: Delete .vercel/ and run 'npx vercel link' from repo root."
    exit 1
  fi
fi

# --- Secret Scanning ---

# Get list of staged files (excluding deleted)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Secret patterns to detect
PATTERNS=(
  'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'  # JWT tokens
  'AKIA[0-9A-Z]{16}'                            # AWS Access Key ID
  'sk-[A-Za-z0-9]{20,}'                         # OpenAI/Stripe secret keys
  'ghp_[A-Za-z0-9]{36}'                         # GitHub PAT
  'npm_[A-Za-z0-9]{36}'                         # npm tokens
  'service_role_key\s*[:=]\s*["\x27][A-Za-z0-9_-]{20,}'  # Supabase service role value
  'BEGIN.*PRIVATE KEY'                                     # Private keys
  'api[_-]?key\s*[:=]\s*["\x27][A-Za-z0-9_-]{16,}'        # api_key=...
  'secret\s*[:=]\s*["\x27][A-Za-z0-9_-]{16,}'             # secret=...
  'password\s*[:=]\s*["\x27][^\x27"]{8,}'                 # password=...
  'token\s*[:=]\s*["\x27][A-Za-z0-9_-]{16,}'              # token=...
)

FOUND=0

for file in $STAGED_FILES; do
  # Skip binary files and this hook script itself
  if [[ "$file" == *.png || "$file" == *.jpg || "$file" == *.gif || "$file" == *.ico ]]; then
    continue
  fi
  if [[ "$file" == "scripts/install-hooks.sh" ]]; then
    continue
  fi

  # Get staged content
  CONTENT=$(git show ":$file" 2>/dev/null || true)

  if [ -z "$CONTENT" ]; then
    continue
  fi

  for pattern in "${PATTERNS[@]}"; do
    if echo "$CONTENT" | grep -qEi "$pattern"; then
      echo "BLOCKED: Potential secret found in $file"
      echo "  Pattern: $pattern"
      echo "$CONTENT" | grep -Eni "$pattern" | head -3 | sed 's/^/  /'
      FOUND=1
    fi
  done
done

if [ $FOUND -eq 1 ]; then
  echo ""
  echo "Commit blocked: secrets detected in staged files."
  echo "Remove the secrets and try again, or use --no-verify to bypass (not recommended)."
  exit 1
fi

exit 0
HOOK_CONTENT

chmod +x "$HOOK_FILE"
echo "Pre-commit hook installed at $HOOK_FILE"
