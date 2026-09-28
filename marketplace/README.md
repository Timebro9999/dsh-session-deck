# Marketplace submission

The DSH plugin market (`dshmarket`) reads <https://awesome-dsh-plugin.com/plugins.json>, whose index lives in
[`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) — one YAML
file per plugin under `data/plugins/`, generated into the two READMEs.

- Entry: [`Timebro9999__dsh-session-deck.yml`](Timebro9999__dsh-session-deck.yml) (`category: ui`).
- Submission PR: **[awesome-dsh-plugin#6043](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6043)**
  (opened 2026-09-28; one file, +6 lines).
- [`../scripts/open-marketplace-pr.sh`](../scripts/open-marketplace-pr.sh) re-opens it through the GitHub API —
  the index repository is large, so the script never clones it.

Requirements from the index's [contributing guide](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md),
all met here: `dsh.bundle` in `package.json` (not just `dsh.client`), `cordis.patch.yml` at the root, real
working code, the repo at least a day old, the `dsh-plugin` topic, and a description that states what the
plugin does.
