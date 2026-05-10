#!/bin/bash
# Install git pre-commit hook for secret scanning
# Run: bash scripts/install-hooks.sh

HOOK_DIR="$(git rev-parse --git-dir)/hooks"
HOOK_FILE="$HOOK_DIR/pre-commit"

cat > "$HOOK_FILE" << 'HOOK_CONTENT'
#!/bin/bash
# Pre-commit hook: scan staged files for secrets
# Patterns: JWTs, AWS keys, API keys, private keys, tokens, passwords

set -e

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
