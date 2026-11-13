export type ActionList = {
  // The markdown the pane draws; empty until the first /actions run.
  markdown: string
  // When it was collected (ms since epoch); 0 before the first run.
  at: number
  isRunning: boolean
}

declare module 'claude-code' {
  interface PluginState {
    actions: { list: Shaped<ActionList> }
  }
}
