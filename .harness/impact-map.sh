#!/bin/bash
set -euo pipefail

MODULE_PATH="${1:?Usage: impact-map.sh <module-path>}"

echo "=== IMPACT MAP: $MODULE_PATH ==="
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "FILES:"
find "$MODULE_PATH" -type f | sort
echo ""
echo "PYTHON DEPENDENTS:"
grep -r "from $(basename "$MODULE_PATH")\\|import $(basename "$MODULE_PATH")" . --include='*.py' -l 2>/dev/null | grep -v "$MODULE_PATH" | sort || true
echo ""
echo "TYPESCRIPT DEPENDENTS:"
grep -r "from ['\"].*$(basename "$MODULE_PATH")" ./sigma-frontend --include='*.ts' --include='*.tsx' -l 2>/dev/null | sort || true
