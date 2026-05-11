import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  type LanguageModel,
  stepCountIs,
  streamText,
} from 'ai'
import type { NextRequest } from 'next/server'
import { createOllama } from 'ollama-ai-provider-v2'
import { z } from 'zod'

import { type AgentMode, buildSystemPrompt } from '@/lib/agent/system-prompt'
import { deployJobtriageTools, jobtriageTools } from '@/lib/agent/tools'

export const runtime = 'nodejs'
export const maxDuration = 120

const ChatRequestSchema = z.object({
  messages: z.array(z.unknown()),
  profile: z.string().max(20_000).nullable().optional(),
})

const ANTHROPIC_MODEL_ID = process.env.ANTHROPIC_MODEL_ID ?? 'claude-sonnet-4-5'
const OPENAI_MODEL_ID = process.env.OPENAI_MODEL_ID ?? 'gpt-4o-mini'
const GEMINI_MODEL_ID = process.env.GEMINI_MODEL_ID ?? 'gemini-2.5-flash'
const OLLAMA_MODEL_ID = process.env.OLLAMA_MODEL_ID ?? 'gemma4:26b'
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api'
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX ?? '8192')

const BYOK_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const
type ByokProvider = (typeof BYOK_PROVIDERS)[number]
type ProviderName = ByokProvider | 'ollama'

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface ResolvedProvider {
  model: LanguageModel
  providerName: ProviderName
  redactSecret?: string
}

function isByokProvider(value: string): value is ByokProvider {
  return (BYOK_PROVIDERS as readonly string[]).includes(value)
}

function buildByokModel(provider: ByokProvider, apiKey: string): LanguageModel {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(ANTHROPIC_MODEL_ID)
    case 'openai':
      return createOpenAI({ apiKey })(OPENAI_MODEL_ID)
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey })(GEMINI_MODEL_ID)
  }
}

function resolveProvider(request: NextRequest): ResolvedProvider | Response {
  const header = request.headers.get('x-jobtriage-provider') ?? 'anthropic'

  if (header === 'ollama') {
    const ollama = createOllama({ baseURL: OLLAMA_BASE_URL })
    return { model: ollama(OLLAMA_MODEL_ID), providerName: 'ollama' }
  }

  if (!isByokProvider(header)) {
    return jsonError(400, `Unknown provider: ${header}`)
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const apiKey = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : ''
  if (!apiKey) {
    return jsonError(401, `Missing Authorization: Bearer <${header} key>`)
  }

  return {
    model: buildByokModel(header, apiKey),
    providerName: header,
    redactSecret: apiKey,
  }
}

function resolveAgentMode(
  providerName: ProviderName,
  request: NextRequest,
): AgentMode {
  const headerOverride = request.headers.get('x-jobtriage-mode')
  if (headerOverride === 'deploy' && !process.env.VERCEL) {
    return 'deploy'
  }
  return providerName === 'ollama' ? 'local' : 'deploy'
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

  const today = new Date().toISOString().slice(0, 10)
  const mode = resolveAgentMode(resolved.providerName, request)
  const tools = mode === 'deploy' ? deployJobtriageTools : jobtriageTools
  const result = streamText({
    model: resolved.model,
    system: buildSystemPrompt(parsed.data.profile, today, mode),
    messages: await convertToModelMessages(
      parsed.data.messages as Parameters<typeof convertToModelMessages>[0],
    ),
    tools,
    stopWhen: stepCountIs(8),
    ...(resolved.providerName === 'ollama' && {
      providerOptions: { ollama: { options: { num_ctx: OLLAMA_NUM_CTX } } },
    }),
  })

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    onError: (error) => {
      const message = extractErrorMessage(error)
      return resolved.redactSecret
        ? message.replaceAll(resolved.redactSecret, '[redacted]')
        : message
    },
  })
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  if (error && typeof error === 'object') {
    const candidate = (error as { message?: unknown }).message
    if (typeof candidate === 'string' && candidate) return candidate
  }
  return 'Streaming failed before completion'
}
