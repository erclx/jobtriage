import type { DynamicToolUIPart, ToolUIPart } from 'ai'

export type AnyToolPart = ToolUIPart | DynamicToolUIPart

export function isToolPart(part: { type: string }): part is AnyToolPart {
  return part.type.startsWith('tool-') || part.type === 'dynamic-tool'
}
