import { AI_ENGINEER_PROFILE, NURSE_PROFILE } from '@/features/mock/profiles'

export interface MockPrompt {
  readonly prompt: string
  readonly chipLabel: string
  readonly profile: string
}

export const MOCK_PROMPTS: readonly MockPrompt[] = [
  {
    prompt: 'Show me Stockholm AI engineering roles',
    chipLabel: 'Show me Stockholm AI engineering roles',
    profile: AI_ENGINEER_PROFILE,
  },
  {
    prompt: 'Find Stockholm nursing roles ranked against my profile',
    chipLabel: 'Find Stockholm nursing roles ranked against my profile',
    profile: NURSE_PROFILE,
  },
  {
    prompt: 'Compare two top machine learning roles side by side',
    chipLabel: 'Compare two top machine learning roles side by side',
    profile: AI_ENGINEER_PROFILE,
  },
  {
    prompt: 'Which AI roles are closing in the next two weeks',
    chipLabel: 'Which AI roles are closing in the next two weeks',
    profile: AI_ENGINEER_PROFILE,
  },
] as const
