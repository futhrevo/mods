# actions

Agent replies often bury the asks for you deep in long, jargon-heavy messages, and hand you work the
agent could have done itself. This mod fixes both.

## Always on: the agent does its own work

Every session gets one extra system-prompt rule: before handing a step to you, the agent checks whether it
can do it itself (its tools, a CLI or API call, an MCP tool, a subagent) and does it if that is within its
permissions. It asks you only for what strictly needs a human, and says why.

## `/actions`: everything that needs you, in one pane

Type `/actions`. The agent rereads the whole conversation and sorts every open item:

- **Agent can do it** (look up, run, check, draft, fix): it does these now, in parallel with subagents
  where it can, and lists them under "Done by the agent" with evidence.
- **Strictly needs you** (a choice only you can make, approval before something irreversible or
  outward-facing, access it lacks, a screen it cannot operate, something physical):
  - **Decisions** come with lettered options, what each means, what your wiki says about it, a
    recommendation, and the exact words to reply with.
  - **Tasks** come as numbered steps with the exact app, URL, menu path, command and values, written for
    someone who hasn't read the spec or used the tool, and say how you know it's done.

The list lands in the "Your action items" pane and stays there until you run `/actions` again.

## Your wiki

For decisions, the agent reads your notes wiki first (past decisions, preferences, people, project
context) and names the page it used. Set the folder under `/config` → actions → Knowledge wiki folder
(default `~/Library/Mobile Documents/com~apple~CloudDocs/llmwiki`; skipped if the folder isn't there,
empty to turn off).

## Cost

`/actions` is one full agent turn: it reads, runs the agent-doable items, and may start subagents. The
always-on rule costs a few lines of system prompt.
