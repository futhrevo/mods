import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ActionList } from '../types'

const PANE = 'actions'
const TITLE = 'Your action items'
const TOOL = 'publish_action_items'
const list = atom({ plugin: 'actions', key: 'list' } as const, { markdown: '', at: 0, isRunning: false }, {
  shape: 'list-1',
})

// Rides in the system prompt of every session the mod is on, so work the agent can do is not handed to the person.
export const DO_IT_YOURSELF = `Before handing any step to the user, check whether you can do it yourself: your own tools,
a CLI or API call, an MCP tool, a subagent. If you can, and it is within your permissions and the project's rules, do it
instead of asking. Ask the user only for what strictly needs a human: a choice only they can make (preference, priority,
a business or product call), approval before an irreversible or outward-facing action, credentials or access you lack,
a screen you cannot operate, something physical, or contacting another person. When you do hand something over, say in
plain words what it is and why only they can do it.`

export function ask(wikiDir: string): string {
  const wiki = wikiDir
    ? `the user's knowledge wiki at "${wikiDir}" (if that folder exists: start from its index.md files, then open the pages that bear on the decision)`
    : 'none configured'
  return `The user ran /actions. Collect every open action item in this conversation, do the ones you can, and publish
the rest for the user.

1. Reread the whole conversation, including replies far back. List every open item: steps you told the user to take,
   questions you asked that went unanswered, next steps you mentioned. Skip anything done, answered or superseded later.
2. Classify each item:
   - AGENT: you can complete it with your tools (shell, files, CLIs and APIs, MCP tools, subagents, the web). Checking,
     looking up, running, drafting and verifying are all AGENT work.
   - HUMAN: strictly needs the user: a choice only they can make, approval before an irreversible or outward-facing action
     (production writes, messages to customers or other people, merges, payments, deletes), credentials or access you lack,
     a screen you cannot operate, something physical.
   Split an item that has both parts.
3. Do every AGENT item now. Run independent ones in parallel with subagents. Keep to your normal permissions and the
   project's rules; if one turns out to need the user, move it to HUMAN and say why.
4. For each HUMAN decision, consult ${wiki}: past decisions, stated preferences, people and project context. Let what you
   find shape the options and the recommendation, and name the page. If nothing there bears on it, write "nothing relevant".
5. Call the tool mcp__actions__${TOOL} once with the markdown below, then reply with one short line.

Write for someone who has not read the spec, the code or the docs and does not know the tool: plain words, any
unavoidable technical term explained in brackets, the item that blocks the most work first. Use this layout:

# N things need you

## 1. <short plain title>
**Type:** Decision | Task  ·  **Blocks:** <what waits on this>
**Why only you:** <one line>
**Why it matters:** <one or two sentences>

For a Decision:
**Options:**
- **A. <option>** — what happens if chosen, cost or risk
- **B. <option>** — ...
**From your wiki:** <what it says and the page name, or "nothing relevant">
**Recommended:** <letter> — <one-line reason>
**How to answer:** <the exact words to send back, e.g. "Reply: go with A">

For a Task:
**You need:** <accounts, access or files needed first; omit if none>
**Steps:**
1. <one concrete action: the exact app, URL, menu path, file or command; what to click or type, with exact values;
   commands in a code block>
2. ...
**Done when:** <what you will see when it worked>
**Then:** <what to tell the agent afterwards, if anything>

---
## Done by the agent (M)
- <item> — what you did and the result, with evidence (a count, a file, a link)

## Tried, could not finish (K)
- <item> — what blocked it; omit this section when empty

If nothing needs the user, the first heading is "# Nothing needs you right now".`
}

export const register: Register = (on, options) => {
  const wikiDir = String(options.wikiDir ?? '').trim()
  // Set once the /actions turn has started, so its end can clear a run the agent never published.
  let awaitingEnd = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'actions',
      description: 'Do what the agent can, then list what strictly needs you: decisions with options, tasks as steps',
    })
    await $.tool.register({
      name: TOOL,
      description:
        'Publish the action-item list to the user\'s "Your action items" pane. Call it only when the user ran /actions, ' +
        'once, after doing every item you can do yourself.',
      inputSchema: {
        type: 'object',
        properties: { markdown: { type: 'string', description: 'The full list, in the layout /actions asked for.' } },
        required: ['markdown'],
      },
      isDeferred: false,
    })
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    return { sections: [...out.sections, { id: 'actions:do-it-yourself', text: DO_IT_YOURSELF, scope: 'session' }] }
  })

  on('command.run', { command: 'actions' }, async $ => {
    if ((await read($, list)).isRunning) return { text: 'Already collecting your action items.' }
    await update($, list, l => ({ ...l, isRunning: true }))
    void $.ui.open({ id: PANE, title: TITLE })
    // A command may not submit a prompt itself (it would wait on the turn this command holds): a timer submits
    // it once the command has ended. It resolves when that turn starts.
    $.clock.after(50, async () => {
      await $.prompt.submit({ text: ask(wikiDir) })
      awaitingEnd = true
    })
    return { text: 'Doing what the agent can, then listing what needs you in the "Your action items" pane.' }
  })

  on('tool.call', { tool: 'mcp__actions__publish_action_items' }, async ($, e) => {
    const markdown = String((e as { markdown?: unknown }).markdown ?? '').trim()
    if (!markdown) return { deny: 'markdown is empty' }
    await update($, list, () => ({ markdown, at: Date.now(), isRunning: false }))
    return { result: 'Published to the "Your action items" pane.' }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && awaitingEnd) {
      awaitingEnd = false
      await update($, list, l => (l.isRunning ? { ...l, isRunning: false } : l))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Markdown } = $.ui.resolve(e)
    const l: ActionList = await read($, list)
    const when = l.at ? new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    return (
      <Box flexDirection="column">
        {l.isRunning && <Text dimColor>Working… the agent is doing what it can, then listing what needs you.</Text>}
        {!l.markdown && !l.isRunning && <Text dimColor>Run /actions to collect what needs you.</Text>}
        {l.markdown && <Markdown text={l.markdown} />}
        {when && <Text dimColor>Collected {when}. Run /actions again to refresh.</Text>}
      </Box>
    )
  })
}
