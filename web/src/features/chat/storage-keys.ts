export const SESSION_KEYS = {
  apiKey: 'jobtriage:anthropic-api-key',
  profile: 'jobtriage:profile-markdown',
  provider: 'jobtriage:provider',
  canvas: 'jobtriage:canvas-state',
  railWidth: 'jobtriage:rail-width',
} as const

export const RAIL_WIDTH_DEFAULT = 380
export const RAIL_WIDTH_MIN = 320
export const RAIL_WIDTH_MAX = 640

export type Provider = 'anthropic' | 'ollama'

export const OLLAMA_MARKER = 'ollama'
