#!/bin/bash
set -euo pipefail

# Gate 1: Block secret-bearing files
SECRET_FILES=$(git diff --cached --name-only | grep -E '(^|/)(\.env|\.env\..*|.*secret.*|.*token.*)$' || true)
if [ -n "$SECRET_FILES" ]; then
  echo "ERROR: Secret-bearing files staged for commit:"
  echo "$SECRET_FILES"
  echo ""
  echo "FIX: Unstage these files with: git reset HEAD <file>"
  exit 1
fi

# Gate 2: Block debug statements and unresolved comments
VIOLATIONS=$(git diff --cached -G 'TODO|FIXME|HACK|console\.log|print\(' --name-only || true)
if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: Debug statements or unresolved comments found in:"
  echo "$VIOLATIONS"
  echo ""
  echo "FIX: Remove all TODO, FIXME, HACK, console.log(), and print() calls from these files before committing."
  exit 1
fi
