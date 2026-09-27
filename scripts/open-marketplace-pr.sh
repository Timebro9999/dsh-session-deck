#!/usr/bin/env bash
# Open the marketplace submission PR for this plugin.
#
# The DSH plugin market reads https://awesome-dsh-plugin.com/plugins.json, whose
# index lives in github.com/awesome-dsh-plugin/awesome-dsh-plugin: one YAML file
# per plugin under data/plugins/. This script forks that repo, adds the entry and
# opens the PR.
#
# Note: the index's CI requires the plugin repo to be at least 1 day old, so run
# this the day after the repository is created.
set -euo pipefail

OWNER=Timebro9999
REPO=dsh-session-deck
INDEX=awesome-dsh-plugin/awesome-dsh-plugin
ENTRY="$OWNER__$REPO.yml"
SOURCE="$(cd "$(dirname "$0")/.." && pwd)/marketplace/$ENTRY"

[ -f "$SOURCE" ] || { echo "missing $SOURCE" >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

gh repo fork "$INDEX" --clone=false >/dev/null
gh repo clone "$OWNER/awesome-dsh-plugin" "$work/index" -- --depth 1
cd "$work/index"
git checkout -b "add-$OWNER-$REPO"
cp "$SOURCE" "data/plugins/$ENTRY"
git add "data/plugins/$ENTRY"
git -c user.name="$OWNER" -c user.email="$(git config user.email)" commit -m "Add $OWNER/$REPO"
git push -u origin "add-$OWNER-$REPO"
gh pr create \
  --repo "$INDEX" \
  --title "Add $OWNER/$REPO" \
  --body "Adds \`$OWNER/$REPO\` (\`category: ui\`).

- \`package.json\` declares \`dsh.bundle\` (+ \`dsh.client\`), with \`cordis.patch.yml\` at the repo root.
- Pure DOM overlay: no slots, no client-service requirements, no runtime dependencies, no build step.
- Self-check: \`npm test\` (148 + 7 assertions), green in CI on Node 22/24.
- Repo topic \`dsh-plugin\` added."
echo "PR opened against $INDEX"
