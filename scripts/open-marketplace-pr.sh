#!/usr/bin/env bash
# Open the marketplace submission PR for this plugin.
#
# The DSH plugin market reads https://awesome-dsh-plugin.com/plugins.json, whose
# index lives in github.com/awesome-dsh-plugin/awesome-dsh-plugin: one YAML file
# per plugin under data/plugins/. This script forks that repo, adds the entry and
# opens the PR.
#
# It goes through the GitHub API instead of cloning: the index repository carries
# a file per plugin plus generated READMEs, and cloning it over a slow link takes
# minutes. Three small API calls do the same job in seconds.
#
# The index's CI requires the plugin repo to be at least 1 day old.
set -euo pipefail

OWNER=Timebro9999
REPO=dsh-session-deck
INDEX=awesome-dsh-plugin/awesome-dsh-plugin
ENTRY="$OWNER__$REPO.yml"
BRANCH="add-$OWNER-$REPO"
SOURCE="$(cd "$(dirname "$0")/.." && pwd)/marketplace/$ENTRY"

[ -f "$SOURCE" ] || { echo "missing $SOURCE" >&2; exit 1; }

gh repo fork "$INDEX" --clone=false >/dev/null 2>&1 || true
BASE=$(gh api "repos/$OWNER/awesome-dsh-plugin/git/ref/heads/main" --jq '.object.sha')

gh api -X POST "repos/$OWNER/awesome-dsh-plugin/git/refs" \
  -f ref="refs/heads/$BRANCH" -f sha="$BASE" >/dev/null

gh api -X PUT "repos/$OWNER/awesome-dsh-plugin/contents/data/plugins/$ENTRY" \
  -f message="Add $OWNER/$REPO" \
  -f content="$(base64 < "$SOURCE" | tr -d '\n')" \
  -f branch="$BRANCH" >/dev/null

gh pr create \
  --repo "$INDEX" \
  --head "$OWNER:$BRANCH" \
  --title "Add $OWNER/$REPO" \
  --body "Adds \`$OWNER/$REPO\`.

- \`package.json\` declares \`dsh.bundle\` (patch: \`./cordis.patch.yml\`) plus \`dsh.client\`.
- Published on npm as \`dsh-session-deck\`.
- Real, working code: a pure DOM overlay (no slots, no runtime dependencies, no build step).
- Self-check: \`npm test\`, green in CI.
- Repo topic \`dsh-plugin\` added."
echo "PR opened against $INDEX"
