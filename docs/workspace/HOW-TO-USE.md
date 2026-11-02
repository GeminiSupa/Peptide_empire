# The workspace folder

Copies (renamed, so no agent mistakes them for this folder's own rules) of the files at the top of the shared workspace folder
(`costa-website-catalog/`), which holds both projects but is not itself a
Git repository. They live here so they reach GitHub and every colleague's
agent. Keep them in step with the originals when either changes.

To recreate the workspace: clone the repo as `peptidecosta` (branch
`main`), add this branch beside it with
`git worktree add ../peptidecosta-website website`, put both in one parent
folder, and copy `workspace-AGENTS.md` and `workspace-README.md` from here into that parent as `AGENTS.md` and `README.md`,
with a `CLAUDE.md` that reads `@AGENTS.md`.
