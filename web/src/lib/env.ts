import 'server-only'

import { z } from 'zod'

const ServerEnvSchema = z.object({
  JOBTRIAGE_API_BASE_URL: z.url().default('http://localhost:8000'),
  JOBTRIAGE_API_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
})

export type ServerEnv = z.infer<typeof ServerEnvSchema>

export const serverEnv: ServerEnv = ServerEnvSchema.parse({
  JOBTRIAGE_API_BASE_URL: process.env.JOBTRIAGE_API_BASE_URL,
  JOBTRIAGE_API_TIMEOUT_MS: process.env.JOBTRIAGE_API_TIMEOUT_MS,
})
