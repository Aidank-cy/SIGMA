#!/bin/bash
set -euo pipefail

if git diff --cached --name-only | grep -E '(^|/)(\.env|\.env\..*|.*secret.*|.*token.*)$' >/dev/null; then
  echo "Refusing to commit likely secret-bearing files."
  exit 1
fi

if git diff --cached | grep -E 'TODO|FIXME|HACK|console\.log|print\(' >/dev/null; then
  echo "Refusing to commit unresolved comments or debug statements."
  exit 1
fi
