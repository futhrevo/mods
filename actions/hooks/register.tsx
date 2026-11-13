import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ActionList } from '../types'

const PANE = 'actions'
const TITLE = 'Your action items'
const list = atom({ plugin: 'actions', key: 'list' } as const, { markdown: '', at: 0, isRunning: false }, {
  shape: 'list-1',
})

// Sent as one extra message after the whole conversation, to the session's own model.
export const ASK = `Pause the task. Do not continue it and do not use tools. Your only job in this reply:
collect every action that needs ME, the human, from this entire conversation, and write them so I can act
without rereading anything.

Which items to include:
- Only actions that need a human: a decision, an approval, a credential or access, a step in a tool or
  website you cannot operate, a message to another person, a review, something physical.
- Leave out anything you can do yourself, and anything already done, answered, or superseded later in the
  conversation. When unsure whether it is still open, include it and say so.
- Look in every reply, including ones far back, and in questions you asked that I never answered.

How to write them:
- Plain words. Assume I have not read the spec, the code, or the docs, and do not know the tool. Explain any
  unavoidable technical term in a few words in brackets.
- Put the item that blocks the most work first.
- Use this exact markdown layout:

# N things need you

## 1. <short plain title>
**Type:** Decision | Task  ·  **Blocks:** <what waits on this, in plain words>
**Why:** <one or two sentences: what this is about and why it matters>

For a Decision:
**Options:**
- **A. <option>** — what happens if chosen, cost or risk
- **B. <option>** — ...
**Recommended:** <letter> — <one-line reason>
**How to answer:** <the exact words to send back, e.g. "Reply: go with A">

For a Task:
**You need:** <accounts, access, or files needed first; omit if none>
**Steps:**
1. <one concrete action: the exact app, URL, menu path, file, or command; what to click or type, with exact
   values copied from the conversation; commands in a code block>
2. ...
**Done when:** <what you will see when it worked>
**Then:** <what to tell me afterwards, if anything>

If nothing needs me, reply with exactly: Nothing needs you right now.`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'actions',
      description: 'List everything in this conversation that needs you: decisions with options, tasks as steps',
    })
    return next(e)
  })

  on('command.run', { command: 'actions' }, async $ => {
    if ((await read($, list)).isRunning) return { text: 'Already collecting your action items.' }
    await update($, list, l => ({ ...l, isRunning: true }))
    void $.ui.open({ id: PANE, title: TITLE })
    $.ui.status('Collecting your action items…')

    const r = await $.model.fork({ prompt: ASK })
    $.ui.status(undefined)

    if (!r.isAnswered) {
      await update($, list, l => ({ ...l, isRunning: false }))
      return { text: `Could not collect action items (${r.reason}).` }
    }
    const markdown = r.text.trim()
    await update($, list, () => ({ markdown, at: Date.now(), isRunning: false }))
    const head = markdown.split('\n').find(line => line.trim()) ?? ''
    return { text: `${head.replace(/^#+\s*/, '')} — see the "${TITLE}" pane.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Markdown } = $.ui.resolve(e)
    const l: ActionList = await read($, list)
    const when = l.at ? new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    return (
      <Box flexDirection="column">
        {l.isRunning && <Text dimColor>Collecting… (reading the whole conversation)</Text>}
        {!l.markdown && !l.isRunning && <Text dimColor>Run /actions to collect what needs you.</Text>}
        {l.markdown && <Markdown text={l.markdown} />}
        {when && <Text dimColor>Collected {when}. Run /actions again to refresh.</Text>}
      </Box>
    )
  })
}
