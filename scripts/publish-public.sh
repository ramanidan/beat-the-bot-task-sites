#!/usr/bin/env bash
# Build static sites. Deploy is one command after you choose a host (free).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm ci
npm run build
echo ""
echo "✓ Built to: $ROOT/dist"
echo ""
echo "Pick one:"
echo "  1) GitHub Pages: push repo, enable Pages → GitHub Actions, workflow .github/workflows/beat-the-bot-pages.yml"
echo "  2) Netlify CLI:  npx netlify login && npx netlify init --dir=dist && npm run deploy:netlify"
echo "  3) Netlify UI:   drag-drop the dist/ folder at https://app.netlify.com/drop"
echo "  4) Cloudflare:   Pages project → beat-the-bot → build npm run build → output dist"
