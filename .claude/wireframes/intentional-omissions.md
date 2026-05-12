---
title: Intentional omissions
description: Surfaces deliberately excluded so they are not re-added later
type: wireframe
---

# Intentional omissions

- No login, no account, no chat history across sessions. Each browser tab is its own session per ARCHITECTURE.md § Per-session profile input.
- No copy-link, copy-message, or share-conversation affordances. Adding them invites a server-side persistence story this project does not have.
- No model selector inside the chat surface. Provider selection happens once at the BYOK gate. To switch, hit `Switch provider` in the header.
- Mobile is documented in [mobile-layout.md](mobile-layout.md) but is not a supported design target. Real responsive polish is queued for v6 if it happens.
