export const SESSION_KEYS = {
  apiKey: 'jobtriage:anthropic-api-key',
  profile: 'jobtriage:profile-markdown',
  profileSource: 'jobtriage:profile-source',
  provider: 'jobtriage:provider',
  canvas: 'jobtriage:canvas-state',
  railWidth: 'jobtriage:rail-width',
  chat: 'jobtriage:chat-messages',
  triedPrompts: 'jobtriage:tried-prompts',
} as const

export type ProfileSource = 'mock' | 'user'

export function readProfileSource(): ProfileSource | null {
  if (typeof window === 'undefined') return null
  const value = window.sessionStorage.getItem(SESSION_KEYS.profileSource)
  return value === 'mock' || value === 'user' ? value : null
}

export function writeProfileSource(source: ProfileSource): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(SESSION_KEYS.profileSource, source)
}

export function clearProfileSource(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(SESSION_KEYS.profileSource)
}

export const RAIL_WIDTH_DEFAULT = 440
export const RAIL_WIDTH_MIN = 320
export const RAIL_WIDTH_MAX = 640

export type ByokProvider = 'anthropic' | 'openai' | 'gemini'
export type Provider = ByokProvider | 'ollama' | 'mock'

export const OLLAMA_MARKER = 'ollama'
export const MOCK_MARKER = 'mock'

export interface ByokProviderMeta {
  readonly id: ByokProvider
  readonly label: string
  readonly placeholder: string
  readonly prefixHint: string
  readonly signupLabel: string
  readonly signupUrl: string
}

export const BYOK_PROVIDERS: readonly ByokProviderMeta[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-...',
    prefixHint: 'sk-ant-',
    signupLabel: 'Get an Anthropic key',
    signupUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    prefixHint: 'sk-',
    signupLabel: 'Get an OpenAI key',
    signupUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    placeholder: 'Your Gemini API key',
    prefixHint: '',
    signupLabel: 'Get a free Gemini key',
    signupUrl: 'https://aistudio.google.com/apikey',
  },
] as const

export function getByokProviderMeta(id: ByokProvider): ByokProviderMeta {
  const meta = BYOK_PROVIDERS.find((p) => p.id === id)
  if (!meta) throw new Error(`Unknown BYOK provider: ${id}`)
  return meta
}
