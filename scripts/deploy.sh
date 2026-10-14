#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch (GitHub Pages serves that branch).
# Usage: scripts/deploy.sh   (needs `gh auth login` done once; uses its token per command only)
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE="$(git remote get-url origin)"
CRED=(-c "credential.helper=!gh auth git-credential")

npm run build
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP/"
touch "$TMP/.nojekyll"
(
  cd "$TMP"
  git init -q -b gh-pages
  git config user.name "$(git -C "$OLDPWD" config user.name)"
  git config user.email "$(git -C "$OLDPWD" config user.email)"
  git add -A
  git commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
  git "${CRED[@]}" push -q -f "$REMOTE" gh-pages
)
echo "Deployed. Pages usually updates within a minute."
