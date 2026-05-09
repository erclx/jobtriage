---
title: LLM local models
subtitle: Ollama-compatible open-source models for tool-calling agent loops on a 32 GB GPU
---

Snapshot of the Ollama library and tool-calling benchmarks as of early 2026, sized for a workstation with one RTX-class 32 GB GPU running an agent loop with `num_ctx=8192`. Updated when a new model swap lands.

## VRAM budgeting

The KV cache at 8192 context on a typical 24-32B model adds 1-2 GB on top of the weights. Stay under 24 GB total to leave headroom for prompt processing, vision encoders, and the system. WSL2 hosts must additionally watch Windows-side RAM, since Ollama's stock 131k context window allocates a KV cache that spills past the WSL memory cap into Windows host RAM under inference.

## Candidates

| Ollama tag                        | Params                | Default size    | BFCL v3                        | IFEval                                         | VRAM (model + 8K KV)    | Tool-discipline reputation                                                                                                                                                                                                                                             |
| --------------------------------- | --------------------- | --------------- | ------------------------------ | ---------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gemma4:26b` (MoE)                | 25.2B / 3.8B-active   | 18 GB, 256K ctx | not submitted                  | not submitted                                  | ~19 GB, ~13 GB headroom | Empirical 0/5 false-positives on chitchat probes. Fast (~2.6 s) at MoE active-param tier. Native `tools` capability badge                                                                                                                                              |
| `gemma4:31b`                      | 30.7B dense           | 20 GB, 256K ctx | not submitted                  | not submitted                                  | ~22 GB, ~10 GB headroom | Strongest paper numbers in the family: Tau2 76.9% multi-turn tool use, MMLU Pro 85.2%, GPQA Diamond 84.3%, BigBench Extra Hard 74.4%                                                                                                                                   |
| `mistral-small3.2:24b`            | 24B dense             | 15 GB           | not submitted                  | 84.78% (Mistral self-reported, +2 pp over 3.1) | ~16 GB, ~16 GB headroom | Release notes call out "more robust function-calling template", 2× fewer infinite-generation loops, improved instruction following                                                                                                                                     |
| `qwen3:32b` (instruct, not coder) | 32B dense             | 20 GB           | 75.7% (second only to GLM-4.5) | strong, agentic-tuned                          | ~22 GB, ~10 GB headroom | Non-coder instruct family carries no agentic-RL bias. Native `tools` capability. Supports a `think` toggle to suppress reasoning on chitchat                                                                                                                           |
| `qwen3:30b` (MoE A3B-Instruct)    | 30B / 3.3B-active     | 19 GB           | ~75%                           | strong                                         | ~20 GB, ~12 GB headroom | Same instruct family as :32b but ~5× faster at MoE active-param tier. **Caveat:** `ollama-ai-provider-v2` does not strip thinking-channel content, so `<\|think\|>` blocks leak into chat output                                                                       |
| `qwen3-coder:30b`                 | 30B-A3B MoE           | 19 GB           | not submitted                  | n/a                                            | ~21 GB                  | Coder-tuned, RL-trained on agentic-coding traces, tool-eager by design. **Disqualifies for chat-style agent loops** with a strict no-tool-on-chitchat rule. Prompt tightening cannot beat the prior                                                                    |
| `gpt-oss:20b`                     | 21B MoE / 3.6B-active | 14 GB MXFP4     | ~67-68%                        | strong                                         | ~15 GB, ~17 GB headroom | **Disqualifies for chitchat-discipline use cases.** The harmony reproduction paper documents an even stronger tool-eagerness prior than `qwen3-coder`: it "calls tools from its training distribution with high statistical confidence even when no tools are defined" |
| `gemma3:27b`                      | 27B dense             | 17 GB           | n/a                            | strong                                         | ~19 GB, ~13 GB headroom | **Disqualifies for native Ollama tool calling**: no `tools` capability badge on the Ollama tag, would need a custom Modelfile and manual XML envelope parsing to integrate with `ollama-ai-provider-v2`                                                                |
| `phi4:14b`                        | 14B dense             | 9 GB            | 40.8% (low)                    | moderate                                       | ~10 GB                  | No `tools` capability badge on the base tag, BFCL too weak for an agent loop                                                                                                                                                                                           |

## Per-model sampling defaults

Each family ships with different recommended sampling settings. Carrying one family's settings across a swap is a common cause of regressions on chitchat discipline and tool-selection accuracy.

| Model family          | Recommended sampling                                                                |
| --------------------- | ----------------------------------------------------------------------------------- |
| Gemma 4               | `temperature=1.0, top_p=0.95, top_k=64`                                             |
| Mistral Small 3.2     | `temperature ~0.15`                                                                 |
| Qwen 3 (all variants) | `temperature=0.7`                                                                   |
| Qwen 3 Coder          | special instruction-tuned tool-call template, do not reuse on other Qwen 3 variants |

The chat route handler currently passes only `num_ctx` through `providerOptions.ollama.options` and lets the provider apply defaults. Add per-model sampling overrides only if smoke shows a regression.

## Integration gotchas

### Thinking-mode hygiene

Models with reasoning channels (Qwen 3 thinking variants, Gemma 4 with `<|think|>` enabled) produce internal thoughts in a separate channel from the final answer. `ollama-ai-provider-v2` does not strip these by default, so the thoughts leak into chat output as visible text. Two failure modes seen in practice:

- `qwen3:30b` MoE A3B-Instruct emits the entire reasoning monologue to the user ("Okay, the user said 'hi'. Let me think about how to respond...")
- Multi-turn conversations that include prior thought blocks in history degrade tool-selection accuracy on subsequent turns

Mitigation: prefer non-thinking variants (Mistral, Gemma 4 without the `<|think|>` token, Qwen 3 with `think: false`) until the provider learns to filter.

### `searchJobs`-style strict-input tools

Models with strong code-generation training (Qwen 3 Coder, Mistral Small 3.2 at default temperature, Qwen 3 32B) tend to call structured-filter tools even when the required inputs are unavailable, fabricating placeholder ids. The fix is at the tool-description boundary: state the input format precisely and validate at the API layer with an actionable 4xx that the agent can recover from. The `searchJobs` tool in this project enforces JobTech's 4-3-3 nanoid format at `JobSearchRequest`, returning a 422 the agent can recover from by switching to `triageBatch`.

### Provider parser path

The Vercel AI SDK's `ollama-ai-provider-v2` was historically tuned for Qwen 3 Coder's specially designed function-call format. Mistral and Gemma 4 use Ollama's standard OpenAI-compatible tool schema and work without provider tweaks. GLM-4.5 envelope format is not yet first-class in Ollama core.

## Smoke harness

`web/scripts/model-probe.ts` runs five chitchat probes and three tool-warranted probes per model against the live Next.js stack with the real system prompt and tool schemas. Restart the web server with `OLLAMA_MODEL_ID=<tag>` between rounds. Output lands at `.claude/.tmp/ollama-model-research/smoke-results.md`.

Probe set:

- **Chitchat (expect 0 tool calls):** "hi", "what can you do", "how are you", "thanks", "what is jobtriage"
- **Tool-warranted (expect 1+ correct calls):** "find welder jobs in Göteborg" (`triageBatch` or `semanticSearch`), "what ads expire in the next 7 days" (`deadlineWatch`), "list roles about agentic AI systems" (`triageBatch` or `semanticSearch`)

Re-run the harness on every model swap, and again after any system-prompt or tool-description change. The probe set is small enough to be cheap (~5 min per model) and broad enough to catch the two failure axes that matter most: false-positive tool calls on chitchat and wrong-tool selection on warranted prompts.

## Sources

- [Ollama library](https://ollama.com/library)
- [BFCL v3 leaderboard](https://pricepertoken.com/leaderboards/benchmark/bfcl-v3)
- [Gorilla BFCL changelog](https://github.com/ShishirPatil/gorilla/blob/main/berkeley-function-call-leaderboard/CHANGELOG.md)
- [Mistral Small 3.2 model card](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506)
- [AWS Bedrock release notes for Mistral 3.2](https://aws.amazon.com/blogs/machine-learning/mistral-small-3-2-24b-instruct-2506-is-now-available-on-amazon-bedrock-marketplace-and-amazon-sagemaker-jumpstart/)
- [Qwen3 official blog](https://qwenlm.github.io/blog/qwen3/)
- [QwenLM/Qwen3-Coder issue 475 on tool-calling reliability](https://github.com/QwenLM/Qwen3-Coder/issues/475)
- [Clarifai gpt-oss benchmark comparison](https://www.clarifai.com/blog/openai-gpt-oss-benchmarks-how-it-compares-to-glm-4.5-qwen3-deepseek-and-kimi-k2)
- [alde.dev gpt-oss tool calling notes](https://alde.dev/blog/proper-tool-calling-with-gpt-oss/)
