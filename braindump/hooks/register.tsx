import type { Register } from 'claude-code'

// Prompts shorter than this are sent as typed: short prompts are rarely rambling dictation.
const MIN_WORDS = 30
// Past this the prompt is mostly pasted material (logs, files), not dictation.
const MAX_CHARS = 12000

// Spans the model never sees, so they reach Claude byte-for-byte: ``` fenced blocks (an unclosed
// fence runs to the end), paired HTML-style tags with their content (<hc>…</hc>), then any lone tag.
const PROTECTED = /```[\s\S]*?(?:```|$)|<([A-Za-z][\w-]*)\b[^<>]*>[\s\S]*?<\/\1\s*>|<\/?[A-Za-z][\w-]*\b[^<>]*>/g
const slot = (i: number) => `⟦KEEP ${i}⟧`

export function protect(text: string): { masked: string; kept: string[] } {
  const kept: string[] = []
  const masked = text.replace(PROTECTED, m => slot(kept.push(m) - 1))
  return { masked, kept }
}

// Undefined when the rewrite lost, duplicated or invented a slot: the caller then sends the prompt as typed.
export function restore(rewritten: string, kept: string[]): string | undefined {
  const found = rewritten.match(/⟦KEEP \d+⟧/g) ?? []
  if (found.length !== kept.length) return undefined
  for (let i = 0; i < kept.length; i++) if (!found.includes(slot(i))) return undefined
  return rewritten.replace(/⟦KEEP (\d+)⟧/g, (_, i) => kept[Number(i)])
}

const SYSTEM = `You clean up a voice-dictated prompt (speech-to-text) before a coding agent reads it.
The speaker thinks out loud: fillers, false starts, repeats, self-corrections ("no wait, I mean X"), run-on sentences and misheard words.

Rewrite it into a clear, well-ordered prompt in the speaker's own voice (first person, addressed to the agent):
- Apply every self-correction: keep only the final intent, drop the retracted version.
- Remove fillers, repetition and false starts. Merge points made twice.
- Fix words the transcription obviously misheard when context makes the intended word clear (tool names, code terms, people's names). If unsure, keep the original word.
- Group related points; use a short bullet list when there are several distinct asks or constraints.
- Keep EVERY requirement, constraint, name, number, file path, URL, command, code snippet and pasted block exactly. Never drop a detail, never add a requirement, never answer or carry out the request.
- If something stays genuinely ambiguous, keep it and mark it "(unclear: ...)" rather than guessing.
- Markers like ⟦KEEP 0⟧ stand for quoted text, code or pasted blocks. Keep every marker exactly once, unchanged, in the place it belongs in the sentence.

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
    const { masked, kept } = protect(original)
    // Only the spoken part counts: a short ask around a long paste is not a brain dump.
    const words = masked.replace(/⟦KEEP \d+⟧/g, ' ').split(/\s+/).filter(Boolean).length
    if (words < MIN_WORDS || masked.length > MAX_CHARS) return next(e)

    $.ui.status('Cleaning up brain dump…')
    const r = await $.model.complete({
      model: 'haiku',
      system: SYSTEM,
      prompt: `Dictated prompt:\n\n${masked}`,
      maxTokens: 4096,
      effort: 'low',
      timeoutMs: 20000,
    })
    $.ui.status(undefined)

    const rewritten = r.isAnswered ? r.text.trim() : ''
    const cleaned = rewritten ? restore(rewritten, kept) : undefined
    if (!cleaned) {
      const why = !r.isAnswered ? r.reason : !rewritten ? 'empty reply' : 'rewrite dropped quoted text'
      $.ui.toast(`Brain dump cleanup skipped (${why}); sent as typed.`)
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
