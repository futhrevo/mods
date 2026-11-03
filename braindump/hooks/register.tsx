import type { Register } from 'claude-code'

// Prompts shorter than this are sent as typed: short prompts are rarely rambling dictation.
const MIN_WORDS = 30
// Past this the prompt is mostly pasted material (logs, files), not dictation.
const MAX_CHARS = 12000

const SYSTEM = `You clean up a voice-dictated prompt (speech-to-text) before a coding agent reads it.
The speaker thinks out loud: fillers, false starts, repeats, self-corrections ("no wait, I mean X"), run-on sentences and misheard words.

Rewrite it into a clear, well-ordered prompt in the speaker's own voice (first person, addressed to the agent):
- Apply every self-correction: keep only the final intent, drop the retracted version.
- Remove fillers, repetition and false starts. Merge points made twice.
- Fix words the transcription obviously misheard when context makes the intended word clear (tool names, code terms, people's names). If unsure, keep the original word.
- Group related points; use a short bullet list when there are several distinct asks or constraints.
- Keep EVERY requirement, constraint, name, number, file path, URL, command, code snippet and pasted block exactly. Never drop a detail, never add a requirement, never answer or carry out the request.
- If something stays genuinely ambiguous, keep it and mark it "(unclear: ...)" rather than guessing.

Output only the rewritten prompt, no preamble.`

export const register: Register = on => {
  // Session toggle; a reload turns it back on.
  let enabled = true

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'braindump',
      description: 'Toggle cleanup of voice-dictated prompts before Claude reads them (on by default)',
    })
    return next(e)
  })

  on('command.run', { command: 'braindump' }, async () => {
    enabled = !enabled
    return { text: `Brain dump cleanup ${enabled ? 'on' : 'off'} for this session.` }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!enabled || e.command || e.isMeta) return next(e)
    if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') return next(e)
    const original = e.text.trim()
    const words = original.split(/\s+/).length
    if (words < MIN_WORDS || original.length > MAX_CHARS) return next(e)

    $.ui.status('Cleaning up brain dump…')
    const r = await $.model.complete({
      model: 'haiku',
      system: SYSTEM,
      prompt: `Dictated prompt:\n\n${original}`,
      maxTokens: 4096,
      effort: 'low',
      timeoutMs: 20000,
    })
    $.ui.status(undefined)

    const cleaned = r.isAnswered ? r.text.trim() : ''
    if (!cleaned) {
      $.ui.toast(`Brain dump cleanup skipped (${r.isAnswered ? 'empty reply' : r.reason}); sent as typed.`)
      return next(e)
    }

    $.ui.toast(`Brain dump cleaned: ${words} → ${cleaned.split(/\s+/).length} words`)
    return next({
      ...e,
      text: cleaned,
      context: [
        ...(e.context ?? []),
        `The prompt above was cleaned up from the user's voice dictation by an automatic rewriter. ` +
          `The raw dictation follows; if the cleaned prompt seems to have lost or changed something, trust the raw dictation.\n\n` +
          `<raw_dictation>\n${original}\n</raw_dictation>`,
      ],
    })
  })
}
