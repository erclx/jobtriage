---
description: Confirm before a destructive deploy operation or a multi-path rm
---

# Destructive operation standards

## Deploy

- Prefer CLI over the dashboard for deploy infrastructure (Cloud Run, Vercel, Cloudflare). Run inspection, redeploy, env-var, and domain commands from Bash rather than asking the user to click through.
- Confirm before a destructive deploy operation: delete service, force-push production, change live DNS.

## Filesystem

- Before a multi-path `rm` or `rm -rf`, list every target path in chat and wait for explicit confirmation.
- Do not treat "clean up X" as authorization for a different destructive action than the one it named.
