import 'server-only'

import type { MockScript, MockStep } from '@/features/mock/scripts/types'

const TEXT_DELTA_MS = 80
const TOOL_PRE_DELAY_MS = 800
const TOOL_INPUT_TO_OUTPUT_MS = 200
const WORDS_PER_DELTA = 4

const STREAM_HEADERS: HeadersInit = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  connection: 'keep-alive',
  'x-vercel-ai-ui-message-stream': 'v1',
  'x-accel-buffering': 'no',
}

interface UiChunk {
  readonly [key: string]: unknown
}

function encodeChunk(chunk: UiChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const handle = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(handle)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function splitIntoDeltas(content: string): readonly string[] {
  const tokens = content.match(/\S+\s*|\s+/g) ?? []
  const deltas: string[] = []
  let buffer = ''
  let wordCount = 0
  for (const token of tokens) {
    buffer += token
    if (/\S/.test(token)) wordCount += 1
    if (wordCount >= WORDS_PER_DELTA) {
      deltas.push(buffer)
      buffer = ''
      wordCount = 0
    }
  }
  if (buffer.length > 0) deltas.push(buffer)
  return deltas
}

async function emitText(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  textId: string,
  content: string,
  signal: AbortSignal,
): Promise<void> {
  controller.enqueue(
    encoder.encode(encodeChunk({ type: 'text-start', id: textId })),
  )
  for (const delta of splitIntoDeltas(content)) {
    await sleep(TEXT_DELTA_MS, signal)
    controller.enqueue(
      encoder.encode(encodeChunk({ type: 'text-delta', id: textId, delta })),
    )
  }
  controller.enqueue(
    encoder.encode(encodeChunk({ type: 'text-end', id: textId })),
  )
}

async function emitTool(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  step: Extract<MockStep, { kind: 'tool' }>,
  signal: AbortSignal,
): Promise<void> {
  await sleep(TOOL_PRE_DELAY_MS, signal)
  controller.enqueue(
    encoder.encode(
      encodeChunk({
        type: 'tool-input-available',
        toolCallId: step.toolCallId,
        toolName: step.toolName,
        input: step.input,
      }),
    ),
  )
  await sleep(TOOL_INPUT_TO_OUTPUT_MS, signal)
  controller.enqueue(
    encoder.encode(
      encodeChunk({
        type: 'tool-output-available',
        toolCallId: step.toolCallId,
        output: step.output,
      }),
    ),
  )
}

export function replayMockScript(script: MockScript): Response {
  const encoder = new TextEncoder()
  const controllerRef: {
    controller: ReadableStreamDefaultController<Uint8Array> | null
  } = {
    controller: null,
  }
  const abortController = new AbortController()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef.controller = controller
    },
    cancel(reason) {
      abortController.abort(reason)
    },
  })

  void runScript()

  async function runScript(): Promise<void> {
    const controller = controllerRef.controller
    if (!controller) return
    const signal = abortController.signal
    try {
      controller.enqueue(
        encoder.encode(
          encodeChunk({ type: 'start', messageId: script.messageId }),
        ),
      )
      controller.enqueue(encoder.encode(encodeChunk({ type: 'start-step' })))
      let textCounter = 0
      for (const step of script.steps) {
        if (signal.aborted) break
        if (step.kind === 'text') {
          textCounter += 1
          await emitText(
            controller,
            encoder,
            `${script.messageId}-text-${textCounter}`,
            step.content,
            signal,
          )
        } else {
          await emitTool(controller, encoder, step, signal)
        }
      }
      controller.enqueue(encoder.encode(encodeChunk({ type: 'finish-step' })))
      controller.enqueue(encoder.encode(encodeChunk({ type: 'finish' })))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    } catch (error) {
      if (!signal.aborted) {
        controller.enqueue(
          encoder.encode(
            encodeChunk({
              type: 'error',
              errorText:
                error instanceof Error ? error.message : 'mock replay failed',
            }),
          ),
        )
        controller.close()
      }
    }
  }

  return new Response(stream, { status: 200, headers: STREAM_HEADERS })
}

export function replayFallbackText(content: string): Response {
  const script: MockScript = {
    prompt: '',
    chipLabel: '',
    messageId: `mock-${Date.now()}`,
    steps: [{ kind: 'text', content }],
  }
  return replayMockScript(script)
}
