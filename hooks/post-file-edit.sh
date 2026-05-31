#!/bin/bash
set -euo pipefail

# Gate 1: Backend lint
if [ -d sigma-backend ]; then
  (cd sigma-backend && python3 -m ruff check .)
fi

# Gate 2: Frontend build
if [ -d sigma-frontend ] && [ -f sigma-frontend/package.json ]; then
  (cd sigma-frontend && npm run build)
fi

# Gate 3: File size limit (300 lines)
MAX_LINES=300
OVER=$(find sigma-backend/app sigma-frontend/src \
  \( -name '*.py' -o -name '*.ts' -o -name '*.tsx' \) \
  ! -path '*/node_modules/*' ! -path '*/__pycache__/*' \
  -exec wc -l {} + 2>/dev/null \
  | awk -v max="$MAX_LINES" '$1 > max && !/total$/ {print $0}' || true)
if [ -n "$OVER" ]; then
  echo "ERROR: Files exceeding ${MAX_LINES}-line limit:"
  echo "$OVER"
  echo ""
  echo "FIX: Extract logic into separate modules to keep each file under ${MAX_LINES} lines."
  exit 1
fi
