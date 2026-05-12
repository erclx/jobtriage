import { describe, expect, it } from 'vitest'

import {
  type ConversationFixture,
  type ConversationProbe,
  evaluateAdIdRecall,
  evaluateConceptIdDiscipline,
  evaluateConversationProbe,
  evaluateKeywordRecall,
  evaluateRecovery,
  evaluateToolCallAccuracy,
  parseSseStream,
  renderConversationMarkdown,
  summarizeConversation,
} from './probe-eval'

const PASS_DEFAULTS = {
  tool_call_accuracy: 1,
  ad_id_recall_at_k: 0.5,
  keyword_recall: 0.66,
} as const

function fixtureFor(probes: readonly ConversationProbe[]): ConversationFixture {
  return {
    name: 'test',
    description: 'test',
    kind: 'conversation',
    pass_criteria: { ...PASS_DEFAULTS },
    probes,
  }
}

function probe(overrides: Partial<ConversationProbe>): ConversationProbe {
  return {
    slug: 'p',
    category: 'cat',
    prompt: 'q',
    expected_tools: [],
    ...overrides,
  }
}

describe('parseSseStream', () => {
  it('collects ordered tool calls with inputs, outputs, and errors', () => {
    const stream = [
      'data: {"type":"start"}',
      '',
      'data: {"type":"tool-input-available","toolCallId":"a","toolName":"searchJobs","input":{"query":"x"}}',
      '',
      'data: {"type":"tool-output-available","toolCallId":"a","output":{"ads":[{"ad_id":"123"}]}}',
      '',
      'data: {"type":"tool-input-available","toolCallId":"b","toolName":"matchProfile","input":{"ad_id":"123"}}',
      '',
      'data: {"type":"tool-output-error","toolCallId":"b","errorText":"422 Unprocessable Entity"}',
      '',
    ].join('\n')

    const parsed = parseSseStream(stream)

    expect(parsed.toolNames).toEqual(['searchJobs', 'matchProfile'])
    expect(parsed.toolCalls[0]?.input).toEqual({ query: 'x' })
    expect(parsed.toolCalls[0]?.output).toEqual({ ads: [{ ad_id: '123' }] })
    expect(parsed.toolCalls[1]?.errorText).toBe('422 Unprocessable Entity')
  })

  it('joins text deltas into the final assistant text', () => {
    const stream = [
      'data: {"type":"text-delta","id":"t","delta":"Hello"}',
      'data: {"type":"text-delta","id":"t","delta":" world"}',
    ].join('\n\n')

    expect(parseSseStream(stream).text).toBe('Hello world')
  })

  it('ignores malformed data lines instead of throwing', () => {
    const stream = [
      'data: not-json',
      'data: {"type":"text-delta","id":"t","delta":"ok"}',
    ].join('\n')

    expect(parseSseStream(stream).text).toBe('ok')
  })

  it('handles deltas containing escaped quotes', () => {
    const stream =
      'data: {"type":"text-delta","id":"t","delta":"he said \\"hi\\""}'

    expect(parseSseStream(stream).text).toBe('he said "hi"')
  })
})

describe('evaluateToolCallAccuracy', () => {
  it('returns 1 when expected set is empty and no tools fired', () => {
    expect(evaluateToolCallAccuracy(probe({ expected_tools: [] }), [])).toBe(1)
  })

  it('returns 0 when expected set is empty but a tool fired', () => {
    expect(
      evaluateToolCallAccuracy(probe({ expected_tools: [] }), ['searchJobs']),
    ).toBe(0)
  })

  it('returns the fraction of expected tools observed (set match)', () => {
    expect(
      evaluateToolCallAccuracy(
        probe({ expected_tools: ['triageBatch', 'matchProfile'] }),
        ['triageBatch', 'placeAds'],
      ),
    ).toBe(0.5)
  })

  it('requires the exact order when expected_tool_order is true', () => {
    const ordered = probe({
      expected_tools: ['lookupConcept', 'searchJobs'],
      expected_tool_order: true,
    })
    expect(
      evaluateToolCallAccuracy(ordered, ['lookupConcept', 'searchJobs']),
    ).toBe(1)
    expect(
      evaluateToolCallAccuracy(ordered, ['searchJobs', 'lookupConcept']),
    ).toBe(0.5)
  })
})

describe('evaluateAdIdRecall', () => {
  it('returns recall against expected ids found in nested tool outputs', () => {
    const p = probe({
      expected_tools: ['triageBatch'],
      expected_ad_ids: ['30990642', '30966965'],
    })
    const recall = evaluateAdIdRecall(p, [
      {
        toolCallId: 'a',
        toolName: 'triageBatch',
        input: {},
        output: { ads: [{ ad_id: '30990642' }] },
        errorText: null,
      },
    ])
    expect(recall).toBe(0.5)
  })

  it('returns null when ad_id_scope is skip', () => {
    const p = probe({
      expected_ad_ids: ['x'],
      ad_id_scope: 'skip',
    })
    expect(evaluateAdIdRecall(p, [])).toBeNull()
  })

  it('returns null when no expected_ad_ids are configured', () => {
    expect(evaluateAdIdRecall(probe({}), [])).toBeNull()
  })
})

describe('evaluateKeywordRecall', () => {
  it('case-insensitively matches keywords against the assistant text', () => {
    const p = probe({ expected_keywords: ['Volvo', 'Göteborg'] })
    expect(
      evaluateKeywordRecall(p, 'The Volvo role in göteborg looks strong.'),
    ).toBe(1)
  })

  it('returns the fraction present when only some keywords match', () => {
    const p = probe({ expected_keywords: ['a', 'b', 'c'] })
    expect(evaluateKeywordRecall(p, 'a and c only')).toBeCloseTo(2 / 3)
  })

  it('returns null when no keywords are configured', () => {
    expect(evaluateKeywordRecall(probe({}), 'anything')).toBeNull()
  })
})

describe('evaluateConceptIdDiscipline', () => {
  it('passes when lookupConcept precedes searchJobs', () => {
    const p = probe({ concept_id_discipline: true })
    expect(
      evaluateConceptIdDiscipline(p, [
        {
          toolCallId: 'a',
          toolName: 'lookupConcept',
          input: {},
          output: {},
          errorText: null,
        },
        {
          toolCallId: 'b',
          toolName: 'searchJobs',
          input: { occupation_concept_id: 'invalid' },
          output: {},
          errorText: null,
        },
      ]),
    ).toBe(true)
  })

  it('fails when searchJobs is called with a fabricated concept id', () => {
    const p = probe({ concept_id_discipline: true })
    expect(
      evaluateConceptIdDiscipline(p, [
        {
          toolCallId: 'a',
          toolName: 'searchJobs',
          input: { occupation_concept_id: 'not-a-nanoid' },
          output: {},
          errorText: null,
        },
      ]),
    ).toBe(false)
  })

  it('passes when searchJobs is called with a valid nanoid and no prior lookup', () => {
    const p = probe({ concept_id_discipline: true })
    expect(
      evaluateConceptIdDiscipline(p, [
        {
          toolCallId: 'a',
          toolName: 'searchJobs',
          input: { occupation_concept_id: 'DJh5_yyF_hEM' },
          output: {},
          errorText: null,
        },
      ]),
    ).toBe(true)
  })

  it('returns null when discipline is not enabled', () => {
    expect(evaluateConceptIdDiscipline(probe({}), [])).toBeNull()
  })
})

describe('evaluateRecovery', () => {
  it('is true when the recovery tool fires after the errored call', () => {
    const p = probe({
      recovery_required: true,
      recovery_tool: 'lookupConcept',
    })
    expect(
      evaluateRecovery(p, [
        {
          toolCallId: 'a',
          toolName: 'searchJobs',
          input: {},
          output: undefined,
          errorText: '422',
        },
        {
          toolCallId: 'b',
          toolName: 'lookupConcept',
          input: {},
          output: {},
          errorText: null,
        },
      ]),
    ).toBe(true)
  })

  it('is false when no tool error fires', () => {
    const p = probe({ recovery_required: true })
    expect(evaluateRecovery(p, [])).toBe(false)
  })
})

describe('evaluateConversationProbe', () => {
  it('combines criteria into a pass verdict honoring per-probe overrides', () => {
    const p = probe({
      expected_tools: ['triageBatch'],
      expected_keywords: ['Volvo', 'Göteborg', 'missing'],
      pass_criteria: { keyword_recall: 0.5 },
    })
    const verdict = evaluateConversationProbe(p, fixtureFor([p]), {
      toolCalls: [
        {
          toolCallId: 'a',
          toolName: 'triageBatch',
          input: {},
          output: {},
          errorText: null,
        },
      ],
      toolNames: ['triageBatch'],
      text: 'Volvo in Göteborg',
    })
    expect(verdict.pass).toBe(true)
    expect(verdict.keywordRecall).toBeCloseTo(2 / 3)
  })

  it('fails when keyword recall is below the per-probe override', () => {
    const p = probe({
      expected_tools: ['triageBatch'],
      expected_keywords: ['Volvo', 'Göteborg', 'missing', 'also-missing'],
      pass_criteria: { keyword_recall: 0.9 },
    })
    const verdict = evaluateConversationProbe(p, fixtureFor([p]), {
      toolCalls: [
        {
          toolCallId: 'a',
          toolName: 'triageBatch',
          input: {},
          output: {},
          errorText: null,
        },
      ],
      toolNames: ['triageBatch'],
      text: 'Volvo in Göteborg',
    })
    expect(verdict.pass).toBe(false)
  })
})

describe('summarizeConversation', () => {
  it('counts passes, averages metrics, and tracks errors', () => {
    const summary = summarizeConversation('m', [
      {
        probeSlug: 'a',
        category: 'x',
        model: 'm',
        toolNames: ['triageBatch'],
        latencyMs: 100,
        textPreview: '',
        error: null,
        verdict: {
          toolCallAccuracy: 1,
          adIdRecall: 0.5,
          keywordRecall: 1,
          conceptIdDisciplineOk: null,
          recoveryObserved: null,
          pass: true,
        },
      },
      {
        probeSlug: 'b',
        category: 'x',
        model: 'm',
        toolNames: [],
        latencyMs: 0,
        textPreview: '',
        error: 'boom',
        verdict: {
          toolCallAccuracy: 0,
          adIdRecall: null,
          keywordRecall: null,
          conceptIdDisciplineOk: null,
          recoveryObserved: null,
          pass: false,
        },
      },
    ])
    expect(summary.passed).toBe(1)
    expect(summary.total).toBe(2)
    expect(summary.errors).toBe(1)
    expect(summary.avgToolCallAccuracy).toBe(1)
    expect(summary.avgAdIdRecall).toBe(0.5)
    expect(summary.avgLatencyMs).toBe(100)
  })
})

describe('renderConversationMarkdown', () => {
  it('renders a stable column shape and escapes pipes in previews', () => {
    const fixture = fixtureFor([
      probe({ slug: 'a', expected_tools: ['triageBatch'] }),
    ])
    const out = renderConversationMarkdown(
      fixture,
      [
        {
          probeSlug: 'a',
          category: 'x',
          model: 'm',
          toolNames: ['triageBatch'],
          latencyMs: 100,
          textPreview: 'piped | text',
          error: null,
          verdict: {
            toolCallAccuracy: 1,
            adIdRecall: null,
            keywordRecall: null,
            conceptIdDisciplineOk: null,
            recoveryObserved: null,
            pass: true,
          },
        },
      ],
      [
        {
          model: 'm',
          passed: 1,
          total: 1,
          avgToolCallAccuracy: 1,
          avgAdIdRecall: null,
          avgKeywordRecall: null,
          avgLatencyMs: 100,
          errors: 0,
        },
      ],
      'http://test',
      0,
    )

    expect(out).toContain('| Model | Passed |')
    expect(out).toContain('piped \\| text')
    expect(out).toContain('1/1')
  })

  it('renders the inter-probe delay line in the header', () => {
    const fixture = fixtureFor([
      probe({ slug: 'a', expected_tools: ['triageBatch'] }),
    ])
    const out = renderConversationMarkdown(
      fixture,
      [],
      [
        {
          model: 'm',
          passed: 0,
          total: 0,
          avgToolCallAccuracy: 0,
          avgAdIdRecall: null,
          avgKeywordRecall: null,
          avgLatencyMs: 0,
          errors: 0,
        },
      ],
      'http://test',
      6500,
    )

    expect(out).toContain('Inter-probe delay: 6500ms')
  })
})
