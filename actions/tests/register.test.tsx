import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'actions',
  component: 'Pane',
  requestId: 'actions',
  props: {
    title: 'Your action items',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const LIST = '# 1 thing needs you\n\n## 1. Pick a model\n**Type:** Decision\n\n---\n## Done by the agent (1)\n- ran tests'

function engine(on: any, seen: any) {
  on('command.register', () => ({ value: { command: 'actions' } }))
  on('tool.register', () => ({ value: { tool: 'mcp__actions__publish_action_items' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.after', () => ({ value: undefined }))
  on('prompt.submit', (_: any, e: any) => {
    seen.submitted = e.text
    return { text: e.text }
  })
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' }] }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
}

const start = ($: any) => $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

test('/actions hands the agent the do-then-publish job, with the wiki path', { options: { wikiDir: '/wiki' } }, async ($, on) => {
  const seen: any = {}
  engine(on, seen)
  await start($)
  const out: any = await $.command.run({ command: 'actions', args: '' } as any)
  await new Promise(r => setTimeout(r, 200))

  expect(out.text).toContain('Your action items')
  expect(seen.submitted).toContain('Do every AGENT item now')
  expect(seen.submitted).toContain('"/wiki"')
  expect(seen.submitted).toContain('mcp__actions__publish_action_items')
})

test('the publish tool fills the pane', async ($, on) => {
  engine(on, {})
  await start($)
  const r: any = await $.tool.call({ tool: 'mcp__actions__publish_action_items', markdown: LIST } as any)
  expect(r.result).toBe('Published to the "Your action items" pane.')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Markdown' }))?.props?.text).toBe(LIST)
  await ui.unmount()
})

test('an empty publish is refused', async ($, on) => {
  engine(on, {})
  await start($)
  const r: any = await $.tool.call({ tool: 'mcp__actions__publish_action_items', markdown: '  ' } as any)
  expect(r.deny).toBe('markdown is empty')
})

test('every session gets the do-it-yourself rule in its system prompt', async ($, on) => {
  engine(on, {})
  await start($)
  const r: any = await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [], sections: [] } as any)
  expect(r.sections.at(-1).id).toBe('actions:do-it-yourself')
  expect(r.sections.at(-1).text).toContain('strictly needs a human')
})
