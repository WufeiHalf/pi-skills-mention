# pi-skills-mention

Codex-style **`$skill-name` mentions** for the [Pi coding agent](https://pi.dev/).

Pi ships skill invocation as `/skill:name` — usable only at the *start* of a
message, one skill at a time. This extension changes that: write `$` + a skill
name **anywhere** in any prompt to inline that skill's full instructions, and
mention **any number** of skills in a single message.

## What it adds

### 1. `$` runtime expansion (anywhere, multiple at once)

```
$code-review 与 $humanize 帮我审查下午改的 auth 模块，并把结论润色成人话。
```

`$code-review` and `$humanize` are replaced with their full `SKILL.md`
instructions before the agent runs. You can:

- mention skills in the middle or end of a message (`帮我做个 $tdd`),
- mention many at once (`$a $b $c`), interleaved with normal text,
- re-mention anything in later turns — it works in every message.

### 2. `$` autocompletion in the editor

Type `$` in the input box and the skill list appears **immediately** (no need to
type a prefix first), then filters live as you continue typing — matching
Codex's `$` feel. Accept a suggestion to insert `$skill-name`.

### Escape hatch

To write a literal `$name` (e.g. a shell variable) without expanding it, double
the dollar sign: `$$name` renders as `$name`. And since only *known* skill
names expand, `$PATH` or `$FOO` in ordinary text are left completely untouched.

## Install

From the pi project root:

```bash
pi install git:github.com/your-org/pi-skills-mention
# or locally during development:
pi install /home/wufei/Desktop/privatecode/pi-skills-mention
# or with the extension flag for a quick smoke test:
pi -e /home/wufei/Desktop/privatecode/pi-skills-mention/src/index.ts
```

Restart pi (or `/reload`) once installed. Type `$` in the editor to try it.

## How it works

- **Discovery.** Skill names come from the same set pi already loaded into the
  session (`systemPromptOptions.skills`), kept in sync each turn; on the very
  first turn it falls back to pi's own `loadSkills` seeder including
  `~/.agents/skills` and ancestor `.agents/skills`.
- **Expansion.** The `input` event transforms text: every `$<token>` whose
  longest known skill-name prefix matches is replaced with the identical
  `<skill ...>` block pi builds for `/skill:name`, so collapsible skill
  rendering keeps working.
- **Autocomplete.** `ctx.ui.addAutocompleteProvider` wraps pi's built-in
  provider: it only takes over when the cursor sits inside a `$` mention token,
  otherwise it delegates to the original (commands, files, `@`-paths …).

## Gotchas / limitations

- Only **exact skill names** (as discovered by pi) expand. If a skill isn't
  loaded into the session it won't autocomplete or expand.
- `$` inside words that happen to share a skill-name prefix will expand (e.g.
  if a skill named `foo` exists, `$foobar` expands `foo` and leaves `bar`).
  Prefix-collisions are rare given pi's dash-heavy skill naming; use `$$` to
  force a literal when needed.
- Shell variables like `$HOME`, `$PATH` are safe unless a skill coincidentally
  shares their name.

## Development

```bash
npm install
npm test          # unit tests (expansion + autocomplete)
npm run typecheck
npm run build
```

The matching is driven by:

- `src/mention.ts` — `$token` -> skill block expansion
- `src/autocomplete.ts` — `$`-triggered autocomplete provider wrapper
- `src/discover.ts` — session skill cache + first-turn discovery
- `src/skill-registry.ts` — skill indexing + block building

## License

MIT
