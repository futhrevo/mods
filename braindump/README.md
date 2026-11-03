# braindump

Cleans up voice-dictated prompts (Wispr Flow, macOS dictation, any speech-to-text) before Claude reads them.

When you submit a prompt of 30+ words, the mod sends it to Haiku with one job: apply your
self-corrections ("no wait, I mean X"), drop fillers and repeats, fix obviously misheard words,
and order the asks, while keeping every name, number, path, command and pasted block exactly.
Claude gets the cleaned prompt; your raw dictation rides along as hidden context, so nothing is
lost if the rewrite slips.

- Short prompts, slash commands and prompts over 12,000 characters are sent as typed.
- If the rewrite fails or takes over 20 s, the prompt is sent as typed and a toast says why.
- A toast shows each rewrite (`Brain dump cleaned: 182 → 64 words`).
- `/braindump` toggles it off/on for the current session.

Cost: one small Haiku call per long prompt, adding about 1–3 seconds before the turn starts.
