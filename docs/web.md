---
title: Web
description: Next.js app structure, layers, and conventions
---

# Web

Next.js 16 App Router app. Owns the chat UI, the agent loop via the Vercel AI SDK, and the TypeScript tool wrappers that post to the FastAPI backend.

## Stack

- Next.js 16 with the App Router and Turbopack
- React 19
- Tailwind v4 via `@tailwindcss/postcss`
- Vercel AI SDK v6 with `@ai-sdk/anthropic` for the deployed demo and `ollama-ai-provider-v2` for local dev
- AI Elements component library for chat surfaces, vendored under `src/components/ai-elements/`
- shadcn/ui primitives, vendored under `src/components/ui/`
- `next-themes` for system-preference dark mode
- Vitest with jsdom for unit tests, Playwright for end-to-end

## Layout

```plaintext
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  ← root layout, wires next-themes
│   │   ├── page.tsx                    ← composes ApiKeyGate around ChatScreen
│   │   ├── globals.css                 ← shadcn tokens, light and dark
│   │   └── api/chat/route.ts           ← AI SDK streamText with provider switch
│   ├── components/
│   │   ├── ai-elements/                ← vendored AI Elements primitives
│   │   ├── ui/                         ← vendored shadcn primitives
│   │   ├── theme-provider.tsx          ← next-themes wrapper
│   │   └── theme-toggle.tsx            ← sun/moon header button
│   ├── features/chat/                  ← chat surface components and hooks
│   │   ├── api-key-gate.tsx            ← BYOK or local-Ollama gate
│   │   ├── chat-screen.tsx             ← top-level useChat shell
│   │   ├── profile-drawer.tsx          ← per-session profile markdown
│   │   ├── tool-trace.tsx              ← AI Elements Tool wrapper
│   │   ├── empty-state.tsx             ← seed-query suggestions
│   │   ├── seed-queries.ts             ← suggestion strings
│   │   ├── storage-keys.ts             ← session storage keys plus provider type
│   │   ├── use-session-value.ts        ← SSR-safe sessionStorage hook
│   │   └── is-tool-part.ts             ← tool-part type guard
│   ├── lib/
│   │   ├── env.ts                      ← validated server env
│   │   ├── utils.ts                    ← cn helper
│   │   ├── api/
│   │   │   ├── schemas.ts              ← Zod request and response schemas
│   │   │   └── client.ts               ← FastAPI client with timeout
│   │   └── agent/
│   │       ├── tools.ts                ← AI SDK tool registry
│   │       └── system-prompt.ts        ← prompt with optional profile block
│   └── test/setup.ts                   ← Vitest globals
├── e2e/chat.spec.ts                    ← Playwright happy path with mocked /api/chat
├── public/                             ← Static assets
├── scripts/verify.sh                   ← Web verify (typecheck, lint, test)
├── components.json                     ← shadcn config
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

## Conventions

- File and folder names use kebab case. Enforced by `eslint-plugin-check-file`.
- Path alias `@` maps to `./src` (configured in `tsconfig.json`).
- Server components by default. Add `'use client'` only when required.
- Domain UI lives under `src/features/`. Shared, generic UI lives under `src/components/`.
- Tool definitions live in `src/lib/agent/tools.ts` and are registered with the AI SDK inside `src/app/api/chat/route.ts`.
- Vendored shadcn and AI Elements primitives are not edited in place. Wrap them in feature components when extending behavior.
- Tests colocate next to source as `*.test.ts` or `*.spec.ts`. Playwright specs live in `e2e/`.

## Anti-patterns

- Do not use `tsc -b` or composite mode. Use `tsc --noEmit`.
- Do not put Playwright `trace` at the top level of `defineConfig`. It lives under `use`.
- Do not lint the `.next/` build output. It is gitignored and excluded from ESLint.
- Do not run `bunx shadcn@latest init` over the existing `globals.css` without backing it up first.

## Scripts

| Command                 | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `bun run dev`           | Next dev server. Avoid on WSL2, see [development.md](development.md). |
| `bun run build`         | Production build                                                      |
| `bun run start`         | Serve the production build                                            |
| `bun run lint`          | ESLint, zero warnings                                                 |
| `bun run lint:fix`      | Auto-fix ESLint                                                       |
| `bun run typecheck`     | `tsc --noEmit`                                                        |
| `bun run test`          | Vitest watch                                                          |
| `bun run test:run`      | Vitest once                                                           |
| `bun run test:coverage` | Vitest with coverage                                                  |
| `bun run test:e2e`      | Playwright                                                            |
| `bun run check`         | Full web verify                                                       |
| `bun run screenshot`    | Capture screenshots                                                   |

## Provider switching

The chat surface supports two providers, chosen at the gate and persisted in browser sessionStorage:

- Anthropic via `@ai-sdk/anthropic`. The user's `sk-ant-...` key is forwarded as a Bearer header on each request and never persisted server-side.
- Local Ollama via `ollama-ai-provider-v2`. No key required. Defaults to `qwen3-coder:30b` against `localhost:11434`. Override the model id with `OLLAMA_MODEL_ID` and the base URL with `OLLAMA_BASE_URL`.

The route handler at `src/app/api/chat/route.ts` reads the `x-jobtriage-provider` request header to pick the provider per request. Both branches share the same tool registry and system prompt.

## Deploy

Vercel free tier. Wired in v5. The deployed bundle does not carry an Anthropic key. End users supply their own at chat time, held in browser sessionStorage and sent with each request.
