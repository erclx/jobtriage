import { createAnthropic } from '@ai-sdk/anthropic'
import {
  convertToModelMessages,
  type LanguageModel,
  stepCountIs,
  streamText,
} from 'ai'
import type { NextRequest } from 'next/server'
import { createOllama } from 'ollama-ai-provider-v2'
import { z } from 'zod'

import { buildSystemPrompt } from '@/lib/agent/system-prompt'
import { jobtriageTools } from '@/lib/agent/tools'

export const runtime = 'nodejs'
export const maxDuration = 120

const ChatRequestSchema = z.object({
  messages: z.array(z.unknown()),
  profile: z.string().max(20_000).nullable().optional(),
})

const ANTHROPIC_MODEL_ID = 'claude-sonnet-4-5'
const OLLAMA_MODEL_ID = process.env.OLLAMA_MODEL_ID ?? 'gemma4-26b-64k:latest'
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api'

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface ResolvedProvider {
  model: LanguageModel
  redactSecret?: string
}

function resolveProvider(request: NextRequest): ResolvedProvider | Response {
  const provider = request.headers.get('x-jobtriage-provider') ?? 'anthropic'

  if (provider === 'ollama') {
    const ollama = createOllama({ baseURL: OLLAMA_BASE_URL })
    return { model: ollama(OLLAMA_MODEL_ID) }
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const apiKey = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : ''
  if (!apiKey) {
    return jsonError(401, 'Missing Authorization: Bearer <Anthropic key>')
  }
  const anthropic = createAnthropic({ apiKey })
  return { model: anthropic(ANTHROPIC_MODEL_ID), redactSecret: apiKey }
}

export async function POST(request: NextRequest): Promise<Response> {
  const resolved = resolveProvider(request)
  if (resolved instanceof Response) {
    return resolved
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(400, 'Invalid chat request payload')
  }

  const result = streamText({
    model: resolved.model,
    system: buildSystemPrompt(parsed.data.profile),
    messages: await convertToModelMessages(
      parsed.data.messages as Parameters<typeof convertToModelMessages>[0],
    ),
    tools: jobtriageTools,
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Stream error'
      return resolved.redactSecret
        ? message.replaceAll(resolved.redactSecret, '[redacted]')
        : message
    },
  })
}
