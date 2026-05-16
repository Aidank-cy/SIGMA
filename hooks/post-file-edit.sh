#!/bin/bash
set -euo pipefail

if [ -d sigma-backend ]; then
  (cd sigma-backend && python3 -m ruff check .)
fi

if [ -d sigma-frontend ] && [ -f sigma-frontend/package.json ]; then
  (cd sigma-frontend && npm run build)
fi
