export type MockStep =
  | { readonly kind: 'text'; readonly content: string }
  | {
      readonly kind: 'tool'
      readonly toolName: string
      readonly toolCallId: string
      readonly input: Record<string, unknown>
      readonly output: Record<string, unknown>
    }

export interface MockScript {
  readonly prompt: string
  readonly chipLabel: string
  readonly messageId: string
  readonly profile?: string
  readonly steps: readonly MockStep[]
}
