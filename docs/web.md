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
- Vercel AI SDK with `@ai-sdk/anthropic` for deploy and `ollama-ai-provider` for local dev
- AI Elements component library for chat surfaces
- shadcn/ui for structured ad cards
- Vitest with jsdom for unit tests, Playwright for end-to-end

The AI SDK and AI Elements are not yet installed. They land in v3 per the build plan in [ARCHITECTURE.md](../.claude/ARCHITECTURE.md).

## Layout

```plaintext
web/
├── src/
│   ├── app/                    ← Next.js routes
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       └── chat/route.ts   ← AI SDK loop endpoint (planned, v3)
│   ├── components/             ← UI components (planned, v3)
│   ├── lib/
│   │   ├── tools/              ← 7 tool definitions wrapping FastAPI (planned, v3-v4)
│   │   └── api.ts              ← FastAPI client (planned, v3)
│   └── test/
│       └── setup.ts            ← Vitest globals
├── e2e/                        ← Playwright specs
├── public/                     ← Static assets
├── scripts/
│   ├── verify.sh               ← Web verify (typecheck, lint, test, build)
│   └── screenshot.sh
├── .vscode/                    ← Web-specific extensions and settings
├── eslint.config.js
├── next.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

Only `src/app/` and `src/test/` exist today. Other folders land at their phase per ARCHITECTURE.md.

## Conventions

- File and folder names use kebab case. Enforced by `eslint-plugin-check-file`.
- Path alias `@` maps to `./src` (configured in `tsconfig.json`).
- Server components by default. Add `'use client'` only when required.
- Tool definitions live in `src/lib/tools/` and are registered with the AI SDK in `src/app/api/chat/route.ts`.
- Tests colocate next to source as `*.test.ts` or `*.spec.ts`. Playwright specs live in `e2e/`.

## Anti-patterns

- Do not use `tsc -b` or composite mode. Use `tsc --noEmit`.
- Do not put Playwright `trace` at the top level of `defineConfig`. It lives under `use`.
- Do not lint the `.next/` build output. It is gitignored and excluded from ESLint.
- Do not run `bunx shadcn@latest init` over the existing `globals.css` without backing it up first.

## Scripts

| Command                 | Purpose                         |
| ----------------------- | ------------------------------- |
| `bun run dev`           | Next dev server with hot reload |
| `bun run build`         | Production build                |
| `bun run start`         | Serve the production build      |
| `bun run lint`          | ESLint, zero warnings           |
| `bun run lint:fix`      | Auto-fix ESLint                 |
| `bun run typecheck`     | `tsc --noEmit`                  |
| `bun run test`          | Vitest watch                    |
| `bun run test:run`      | Vitest once                     |
| `bun run test:coverage` | Vitest with coverage            |
| `bun run test:e2e`      | Playwright                      |
| `bun run check`         | Full web verify                 |
| `bun run screenshot`    | Capture screenshots             |

## Deploy

Vercel free tier. Wired in v5. The deployed bundle does not carry an Anthropic key. End users supply their own at chat time, held in browser sessionStorage and sent with each request.
