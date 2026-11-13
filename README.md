# mods

Claude Code mods by futhrevo. Add this marketplace once, then install any mod from it.

| Mod | What it does |
|---|---|
| `braindump` | Rewrites long voice-dictated prompts (Wispr Flow etc.) into a clear prompt before Claude reads it. `/braindump` toggles. |
| `actions` | `/actions` lists everything in the conversation that needs you, in a pane: decisions with options, tasks as plain step-by-step instructions. |
| `plain-english` | `/plain` rewrites Claude's last reply in plain English, with no jargon. Costs nothing until you run it. |
| `pr-tracker` | Shows your GitHub PRs (merge state, review, CI, comments) in a pane and above the prompt. Needs `gh`. |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install braindump --marketplace futhrevo/mods
/plugin install actions --marketplace futhrevo/mods
/plugin install plain-english --marketplace futhrevo/mods
/plugin install pr-tracker --marketplace futhrevo/mods
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install plain-english --marketplace futhrevo/mods
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins,
Add marketplace with `futhrevo/mods`, then Add plugin.
