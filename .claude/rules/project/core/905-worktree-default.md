---
description: Default to the main checkout and carry the local worktree push gotchas
---

# Worktree default standards

## Default

- Default to working on the active branch in the main checkout. Reach for a linked worktree via `/claude-worktree` only when a concurrent session would otherwise fight over working-tree state.

## Push gotchas

- Spell-check a worktree branch's diff explicitly before pushing new vocabulary: `git diff --name-only main | grep -vE 'bun\.lock$|\.png$' | xargs bunx cspell --no-must-find-files --no-progress --no-gitignore`. Add unknown real words to the right `.cspell/<bucket>.txt` first. The pre-push cspell check is blind to worktree changes.
- Push a worktree branch from the main checkout via `cd <main-root> && git push -u origin <branch>`. Do not use `git -C <main-root> push`, which triggers a phantom prettier pre-push failure in this repo.
