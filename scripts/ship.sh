#!/usr/bin/env bash
# One-shot: test, build, publish to GitHub and deploy to Vercel production.
# Needs: Node 18+, GitHub CLI (`brew install gh`), and logins it will prompt for once.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v gh >/dev/null || { echo "Install the GitHub CLI first:  brew install gh"; exit 1; }
gh auth status >/dev/null 2>&1 || gh auth login --web --git-protocol https

echo "▸ installing + testing"
npm install --no-audit --no-fund
npm test
npm run build

GH_USER=$(gh api user -q .login)
REPO=${REPO:-fretprint}
# point the in-app "Open source" link at the real repo
sed -i.bak "s#href=\"https://github.com/\"#href=\"https://github.com/$GH_USER/$REPO\"#" index.html && rm -f index.html.bak
git add -A
git -c user.name="$(git config user.name || echo "$GH_USER")" commit -qm "Link GitHub repository" || true

echo "▸ publishing github.com/$GH_USER/$REPO"
if gh repo view "$GH_USER/$REPO" >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$GH_USER/$REPO.git"
  git push -u origin main
else
  gh repo create "$REPO" --public --source . --remote origin --push \
    --description "Every shape has a name — map any fretboard shape to exact notes, chord names and theory. Built-in tuner."
fi
gh repo edit "$GH_USER/$REPO" --add-topic guitar --add-topic music-theory --add-topic chords --add-topic tuner --add-topic web-audio >/dev/null || true

echo "▸ deploying to Vercel (first run asks you to log in and confirm the project)"
npx --yes vercel@latest --prod
