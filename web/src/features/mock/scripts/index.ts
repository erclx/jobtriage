import 'server-only'

import { compareThreeRolesScript } from '@/features/mock/scripts/compare-three-roles'
import { deadlineTimelineScript } from '@/features/mock/scripts/deadline-timeline'
import { stockholmAiEngineeringScript } from '@/features/mock/scripts/stockholm-ai-engineering'
import { stockholmNursingScript } from '@/features/mock/scripts/stockholm-nursing'
import type { MockScript } from '@/features/mock/scripts/types'

export const MOCK_SCRIPTS: readonly MockScript[] = [
  stockholmAiEngineeringScript,
  stockholmNursingScript,
  compareThreeRolesScript,
  deadlineTimelineScript,
] as const

export function findMockScript(prompt: string): MockScript | null {
  const needle = prompt.trim().toLowerCase()
  if (!needle) return null
  return (
    MOCK_SCRIPTS.find(
      (script) => script.prompt.trim().toLowerCase() === needle,
    ) ?? null
  )
}

export type { MockScript } from '@/features/mock/scripts/types'
