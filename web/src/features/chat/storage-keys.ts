export const SESSION_KEYS = {
  apiKey: 'jobtriage:anthropic-api-key',
  profile: 'jobtriage:profile-markdown',
  provider: 'jobtriage:provider',
} as const

export type Provider = 'anthropic' | 'ollama'

export const OLLAMA_MARKER = 'ollama'
