# actions

Type `/actions` to see everything in the conversation that needs you, in one pane.

Agent replies often bury the asks for you deep in long, jargon-heavy messages. `/actions` has the
session's own model reread the whole conversation and list only what a human must do, with the item
that blocks the most work first:

- **Decisions** come with lettered options, what each one means, a recommendation, and the exact words
  to reply with.
- **Tasks** (a setting to change, an approval, a credential, a message to someone) come as numbered
  steps with the exact app, URL, menu path, command and values. They are written for someone who hasn't
  read the spec or used the tool before, and say how you know it's done.

Things the agent can do itself, and things already done or answered, are left out.

- The list stays in the "Your action items" pane until you run `/actions` again.
- Cost: one extra reply from the session's model each time you run it. It reuses the conversation
  already in the prompt cache, so no tools run and nothing is sent anywhere new.
- It reads only the main conversation, not subagents' own transcripts.
