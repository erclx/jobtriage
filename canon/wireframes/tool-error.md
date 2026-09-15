---
title: Tool error
description: Renders when a tool call fails (input validation, upstream error, output validation)
type: wireframe
---

# Tool error

Renders when a tool call fails (input validation, upstream error, output validation).

```plaintext
+------------------------------------------------------------+
| [alert] Tool input invalid: extra fields not permitted     |
|         on deadlineWatch (got query)                       |
+------------------------------------------------------------+
| [wrench] Deadline watch  [Error]                         v |
+------------------------------------------------------------+
```

## Behavior

- The inline alert above the badge surfaces the actual validation message. No `Stream error` panic copy.
- The collapsible badge underneath holds the input and the structured error for engineers.
- The agent loop continues after a tool error. The next chunk is a corrected retry or a graceful fallback to a different tool.
- A top-level red banner over the whole conversation is reserved for stream-fatal errors that abort the run. Tool-level errors do not surface there.
