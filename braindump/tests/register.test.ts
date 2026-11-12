import { expect, test } from 'claude-code/testing'

const DUMP =
  'okay so um I want you to add a retry to the uploader, no wait not the uploader, the downloader, ' +
  'and um make it retry three times, actually make it five times, with backoff and uh log each failure please thanks'

const composer = { kind: 'composer' } as const

function engine(on: any, seen: { text?: string; context?: readonly string[]; asked?: number }, reply: any) {
  on('command.register', () => ({ value: { command: 'braindump' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('model.complete', () => {
    seen.asked = (seen.asked ?? 0) + 1
    return { value: reply }
  })
  on('prompt.submit', (_: any, e: any) => {
    seen.text = e.text
    seen.context = e.context
    return { text: e.text, context: e.context }
  })
}

const answered = {
  isAnswered: true,
  text: 'Add a retry to the downloader: 5 attempts with backoff, logging each failure.',
  usage: { input_tokens: 1, output_tokens: 1 },
}

test('a long dictated prompt is rewritten and the raw dictation rides as context', async ($, on) => {
  const seen: any = {}
  engine(on, seen, answered)
  await $.prompt.submit({ text: DUMP, wait: false, origin: composer } as any)
  expect(seen.asked).toBe(1)
  expect(seen.text).toBe(answered.text)
  expect(seen.context?.[0]).toContain('<raw_dictation>')
  expect(seen.context?.[0]).toContain('no wait not the uploader')
})

test('a short prompt is sent as typed, no model call', async ($, on) => {
  const seen: any = {}
  engine(on, seen, answered)
  await $.prompt.submit({ text: 'run the tests', wait: false, origin: composer } as any)
  expect(seen.asked).toBe(undefined)
  expect(seen.text).toBe('run the tests')
})

const FENCE = '```\nconst x = 1 // um, keep me exactly\n```'
const HC = '<hc>uh this quoted line, no wait, stays as is</hc>'
const QUOTED = `${DUMP} here is the code ${FENCE} and the note ${HC} okay`

function protectedEngine(on: any, seen: any, reply: (prompt: string) => string) {
  on('command.register', () => ({ value: { command: 'braindump' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('model.complete', (_: any, e: any) => {
    seen.modelPrompt = e.prompt
    return { value: { isAnswered: true, text: reply(e.prompt), usage: { input_tokens: 1, output_tokens: 1 } } }
  })
  on('prompt.submit', (_: any, e: any) => {
    seen.text = e.text
    return { text: e.text, context: e.context }
  })
}

test('fenced blocks and tagged text are hidden from the rewriter and come back unchanged', async ($, on) => {
  const seen: any = {}
  protectedEngine(on, seen, () => 'Add a downloader retry. Code: ⟦KEEP 0⟧ Note: ⟦KEEP 1⟧')
  await $.prompt.submit({ text: QUOTED, wait: false, origin: composer } as any)
  expect(seen.modelPrompt).not.toContain('keep me exactly')
  expect(seen.modelPrompt).not.toContain('<hc>')
  expect(seen.text).toBe(`Add a downloader retry. Code: ${FENCE} Note: ${HC}`)
})

test('a rewrite that drops a marker is discarded, prompt sent as typed', async ($, on) => {
  const seen: any = {}
  protectedEngine(on, seen, () => 'Add a downloader retry. Code: ⟦KEEP 0⟧')
  await $.prompt.submit({ text: QUOTED, wait: false, origin: composer } as any)
  expect(seen.text).toBe(QUOTED)
})

test('a short ask around a long paste is not rewritten', async ($, on) => {
  const seen: any = {}
  protectedEngine(on, seen, () => 'should not be called')
  const text = `fix this ${'```\n' + 'line of log output here\n'.repeat(40) + '```'}`
  await $.prompt.submit({ text, wait: false, origin: composer } as any)
  expect(seen.modelPrompt).toBe(undefined)
  expect(seen.text).toBe(text)
})

test('a failed rewrite falls back to the prompt as typed', async ($, on) => {
  const seen: any = {}
  engine(on, seen, { isAnswered: false, reason: 'aborted', usage: { input_tokens: 0, output_tokens: 0 } })
  await $.prompt.submit({ text: DUMP, wait: false, origin: composer } as any)
  expect(seen.text).toBe(DUMP)
  expect(seen.context).toBe(undefined)
})
