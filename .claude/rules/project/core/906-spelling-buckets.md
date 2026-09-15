---
description: Route a real cspell term to the right project dictionary bucket
paths:
  - '.cspell/**'
---

# Spelling bucket standards

## Routing

- Route a real term to `companies.txt` for orgs and products, `people.txt` for person names, `tech-stack.txt` for tools and libs, `project-terms.txt` for everything else.
- Route an auto-generated fixture pulled from an external API (JobTech, taxonomy) to `cspell.json` ignorePaths, not a `.cspell/<bucket>.txt` file. Keep hand-authored `index.ts` and `types.ts` scanned.
- Do not add a Swedish word to a custom txt file unless cspell still flags it after `@cspell/dict-sv` is loaded.
