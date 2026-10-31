import type { Register } from 'claude-code'

const SYSTEM = `You rewrite a coding assistant's reply for a smart non-engineer.
Rules: plain everyday words; no jargon, file paths, code, or acronyms (if a technical term is unavoidable, explain it in a few words); say what happened, why it matters, and what (if anything) the reader must decide or do next. Keep it short: at most 5 bullet points or 120 words. Output only the rewrite.`

export const register: Register = on => {
  // Kept in memory only; no model call until the person runs /plain.
  let lastAnswer = ''

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'plain',
      description: 'Rewrite Claude\'s last reply in plain English (one cheap model call, only when run)',
    })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer' && e.answer) lastAnswer = e.answer
    return next(e)
  })

  on('command.run', { command: 'plain' }, async $ => {
    if (!lastAnswer) return { text: 'No reply to rewrite yet.' }
    const r = await $.model.complete({
      model: 'haiku',
      system: SYSTEM,
      prompt: `Reply to rewrite:\n\n${lastAnswer}`,
      effort: 'low',
    })
    if (!r.isAnswered) return { text: `Could not rewrite (${r.reason}).` }
    return { text: `In plain English:\n${r.text.trim()}` }
  })
}
