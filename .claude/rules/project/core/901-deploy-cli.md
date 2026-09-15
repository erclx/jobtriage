---
description: Prefer CLI over dashboard for deploy infrastructure
---

# Deploy CLI standards

## Tooling

- Prefer CLI over the dashboard for deploy infrastructure (Cloud Run, Vercel, Cloudflare). Run inspection, redeploy, env-var, and domain commands from Bash rather than asking the user to click through.
- Confirm before a destructive deploy operation: delete service, force-push production, change live DNS.
