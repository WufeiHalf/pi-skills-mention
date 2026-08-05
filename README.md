# pi-skills-mention

> **Codex-style `$` skill mentions for Pi** · type `$` to pull up the skill list, and reference any number of skills from anywhere in a prompt.

<p align="center">
  <img alt="pi-skills-mention demo" src="https://raw.githubusercontent.com/WufeiHalf/pi-skills-mention/master/media/poster.png" width="720">
</p>

**pi-skills-mention** brings [Codex]-style `$` mentions of skills to the [Pi coding agent]. Instead of remembering `/skill:name` — which only works at the *start* of a message and expands one skill at a time — you write `$` + a skill name **anywhere** in any prompt:

```
review this code with $code-review, then polish the summary with $humanize
```

Type `$` in the input editor and the skill list appears **immediately** — filter as you type, accept with Enter, mention many at once. Just like Codex.

> [**中文文档** → `README.zh.md`](README.zh.md)

---

## ✨ Features

- **`$` anywhere** — mention skills in the middle or end of any message, not just at the start.
- **Multiple at once** — `$code-review $humanize` expands any number of skills in a single message.
- **Instant autocomplete** — type `$` and the skill list pops up immediately; filter live as you type.
- **Safe by default** — only *known* skill names expand; `$PATH`, `$FOO`, `$(cmd)` etc. pass through untouched.
- **Escape hatch** — `$$name` renders as a literal `$name`.

---

## Install

```bash
pi install npm:pi-skills-mention
```

Or run from source while developing:

```bash
pi -e /path/to/pi-skills-mention/src/index.ts
```

Restart pi (or `/reload`) after installing, then type `$` in the editor to try it.

---

## Usage

Mention any skill by name, anywhere:

```
$tdd 实现这个功能
先审查 $code-review 再提交
帮我把这份总结 $humanize 一下，顺便 $rewrite 精简
$code-review 与 $humanize 帮我审查 auth 模块的改动，并把结论润色成自然的中文。
```

Each `$skill-name` is replaced with that skill's full `SKILL.md` instructions before the agent runs — the identical `<skill ...>` block pi itself uses for `/skill:name`, so collapsible skill rendering keeps working.

**Autocomplete:** press `$`, the skill picker opens immediately with the full list. Keep typing to narrow it. Press Enter (or arrow + Enter) to insert the selected `$skill-name`.

### Tips & edges

- **Fuzzy autocomplete** — `$` matching is fuzzy, not prefix-only: `$impv` matches `improve-codebase`-style skills (letters in order, not necessarily consecutive). Prefix matches still rank first.
- Skills resolve greedily to the **longest known match**: if both `code-review` and `code-review-module` exist, `$code-review-module` uses the bigger one.
- A token that isn't a known skill stays literal — `$HOME`, `$PATH`, `$(cmd)` are untouched.
- Use `$$name` to force a literal `$name`.
- Skill names come from the same set pi already loaded into the session (`systemPromptOptions.skills`), kept in sync every turn; on the very first turn it falls back to pi's own discovery (`~/.pi/agent/skills`, `<cwd>/.pi/skills`, `~/.agents/skills`, ancestor `.agents/skills`).

---

## How it works

| Module | Role |
| --- | --- |
| `src/mention.ts` | `$token` → skill-block expansion |
| `src/autocomplete.ts` | `$`-triggered autocomplete provider wrapper |
| `src/discover.ts` | session skill cache + first-turn discovery |
| `src/skill-registry.ts` | skill indexing + block building |

- **Discovery** uses the skills pi already loaded into the session; on the first turn it falls back to pi's exported `loadSkills` seeder.
- **Expansion** happens in the `input` event (via `transform`), so `$` works on every turn and in any position — escaping pi's single-start-only `/skill:` limitation.
- **Autocomplete** wraps pi's built-in provider through `ctx.ui.addAutocompleteProvider`: it only takes over when the cursor sits inside a `$` mention token, otherwise it delegates to the original (commands, files, `@`-paths …).

---

## Development

```bash
npm install
npm test          # unit tests (expansion + autocomplete)
npm run typecheck
npm run build
npm pack          # inspect publish contents
```

## Gallery preview

The image below is what shows up on the [pi.dev package gallery](https://pi.dev/):

<p align="center">
  <img alt="pi.dev gallery card" src="https://raw.githubusercontent.com/WufeiHalf/pi-skills-mention/master/media/poster.png" width="640">
</p>

---

## License

MIT

[Codex]: https://openai.com/codex
[Pi coding agent]: https://pi.dev
