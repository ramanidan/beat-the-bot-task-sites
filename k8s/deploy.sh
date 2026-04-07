#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Building Vite sites..."
npm run build

echo "Building image beat-the-bot-sites:local ..."
docker build -f Dockerfile.sites -t beat-the-bot-sites:local .

echo "Applying Kubernetes manifests..."
kubectl apply -f "$ROOT/k8s/sites.yaml"

echo "Restarting deployment to pick up image changes..."
kubectl rollout restart deployment/beat-the-bot-sites -n beat-the-bot
kubectl rollout status deployment/beat-the-bot-sites -n beat-the-bot --timeout=120s

echo ""
echo "Done."
echo "  In-cluster URL base:  http://beat-the-bot-sites.beat-the-bot.svc.cluster.local"
echo "  Data page:            http://beat-the-bot-sites.beat-the-bot.svc.cluster.local/data-site/index.html"
echo "  Form page:            http://beat-the-bot-sites.beat-the-bot.svc.cluster.local/form-site/index.html"
echo "  From your Mac (NodePort 30888): http://127.0.0.1:30888/data-site/index.html"
