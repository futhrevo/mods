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

const LIST = '# 1 thing needs you\n\n## 1. Pick a model\n**Type:** Decision'

function engine(on: any, seen: any, reply: any) {
  on('command.register', () => ({ value: { command: 'actions' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('model.fork', (_: any, e: any) => {
    seen.prompt = e.prompt
    return { value: reply }
  })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
}

test('/actions forks the conversation and shows the list in the pane', async ($, on) => {
  const seen: any = {}
  engine(on, seen, { isAnswered: true, text: LIST, usage: { input_tokens: 1, output_tokens: 1 } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const out: any = await $.command.run({ command: 'actions', args: '' } as any)

  expect(seen.prompt).toContain('needs ME, the human')
  expect(out.text).toBe('1 thing needs you — see the "Your action items" pane.')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Markdown' }))?.props?.text).toBe(LIST)
  await ui.unmount()
})

test('a failed fork says why and keeps the pane usable', async ($, on) => {
  const seen: any = {}
  engine(on, seen, { isAnswered: false, reason: 'nothing-to-fork', usage: { input_tokens: 0, output_tokens: 0 } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const out: any = await $.command.run({ command: 'actions', args: '' } as any)

  expect(out.text).toBe('Could not collect action items (nothing-to-fork).')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Run \/actions/ }))?.text).toBe('Run /actions to collect what needs you.')
  await ui.unmount()
})
