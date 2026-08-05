# pi-skills-mention

> **Codex-style `$` skill mentions for Pi** · 输入 `$` 拉起 skill 列表,任意位置、一次多个地引用技能。

<p align="center">
  <img alt="pi-skills-mention demo" src="https://raw.githubusercontent.com/WufeiHalf/pi-skills-mention/master/media/poster.png" width="720">
</p>

**pi-skills-mention** brings [Codex]-style `$` mentions of skills to the [Pi coding agent]. Instead of remembering `/skill:name` (which only works at the *start* of a message and one skill at a time), write `$` + a skill name **anywhere** in any prompt:

```
帮我用 $code-review 审查这段代码，再用 $humanize 润色结论。
```

Type `$` in the input editor and the skill list appears **immediately** — filter as you type, accept with Enter, mention many at once. Just like Codex.

---

## ✨ Features

| | |
|---|---|
| 🎯 **`$` anywhere** | Mention skills in the middle or end of any message — not just at the start |
| 🧮 **Multiple at once** | `$code-review $humanize` — expand any number of skills in a single message |
| 🔮 **Instant autocomplete** | Type `$` → the skill list pops up immediately, filtering live as you type |
| 🔒 **Safe by default** | Only *known* skill names expand; `$PATH`, `$FOO` etc. pass through untouched |
| ⎵ **Escape hatch** | `$$name` renders as a literal `$name` |

---

## 🇬🇧 English

### Install

```bash
pi install npm:pi-skills-mention
```

Or run from source during development:

```bash
pi -e /path/to/pi-skills-mention/src/index.ts
```

Restart pi (or `/reload`) after installing. Type `$` in the editor to try it.

### Usage

Mention any skill by name, anywhere:

```
$tdd 实现这个功能
先审查 $code-review 再提交
帮我把这份总结 $humanize 一下，顺便 $rewrite 精简
```

Each `$skill-name` is replaced with that skill's full `SKILL.md` instructions before the agent runs — the identical `<skill ...>` block pi itself uses for `/skill:name`, so collapsible skill rendering keeps working.

**Autocomplete:** press `$`, the skill picker opens immediately with the full list. Keep typing to narrow it. Press Enter (or arrow + Enter) to insert the selected `$skill-name`.

**Example** — multiple skills in one message:

```
$code-review 与 $humanize 帮我审查 auth 模块的改动，并把结论润色成自然的中文。
```

### Tips & edges

- Skills resolve greedily to the **longest known match**: if `code-review` and `code-review-module` both exist, `$code-review-module` uses the bigger one.
- A token that isn't a known skill stays literal — `$HOME`, `$PATH`, `$(cmd)` are untouched.
- Use `$$name` to force a literal `$name`.
- Skill names come from the same set pi already loaded into the session (`systemPromptOptions.skills`), kept in sync every turn; on the very first turn it falls back to pi's own discovery (`~/.pi/agent/skills`, `<cwd>/.pi/skills`, `~/.agents/skills`, ancestor `.agents/skills`).

---

## 🇨🇳 中文说明

### 安装

```bash
pi install npm:pi-skills-mention
```

开发时可用源码运行:

```bash
pi -e /path/to/pi-skills-mention/src/index.ts
```

安装后重启 pi(或 `/reload`)。在输入框敲 `$` 即可体验。

### 用法

任意位置、按名字引用任意多个 skill:

```
$tdd 实现这个功能
先审查 $code-review 再提交
帮我把这份总结 $humanize 一下，顺便 $rewrite 精简
```

每个 `$skill-name` 会在 agent 运行前被替换成该 skill 的完整 `SKILL.md` 指令 —— 与 pi 原生 `/skill:name` 生成的 `<skill ...>` 块完全一致,因此折叠式 skill 渲染依旧可用。

**自动补全:** 敲下 `$`,skill 选择器立刻弹出完整列表。继续输入可实时过滤;回车(或方向键 + 回车)插入选中的 `$skill-name`。

**示例 —— 一条消息引用多个 skill:**

```
$code-review 与 $humanize 帮我审查 auth 模块的改动，并把结论润色成自然的中文。
```

### 使用注意

- 采用**最长匹配**:若同时存在 `code-review` 和 `code-review-module`,`$code-review-module` 会命中更长那个。
- 不是已知 skill 的 token 原样保留 —— `$HOME`、`$PATH`、`$(cmd)` 不受影响。
- 用 `$$name` 强制输出字面 `$name`。
- skill 名单来自 pi 会话中已加载的集合(`systemPromptOptions.skills`,每轮同步);首轮回退到 pi 自身的发现逻辑(`~/.pi/agent/skills`、`<cwd>/.pi/skills`、`~/.agents/skills`、以及祖先目录的 `.agents/skills`)。

---

## 🧱 How it works / 工作原理

| Module | Role / 职责 |
| --- | --- |
| `src/mention.ts` | `$token` → skill 块展开 · `$`-expansion |
| `src/autocomplete.ts` | `$` 触发补全 provider · autocomplete wrapper |
| `src/discover.ts` | 会话 skill 缓存 + 首轮发现 · session cache + discovery |
| `src/skill-registry.ts` | skill 索引 + 块构建 · indexing + block building |

- **Discovery** uses the skills pi already loaded into the session; on the first turn it falls back to pi's exported `loadSkills` seeder.
- **Expansion** happens in the `input` event (`transform`), so `$` works on every turn and in any position — escaping pi's single-start-only `/skill:` limitation.
- **Autocomplete** wraps pi's built-in provider via `ctx.ui.addAutocompleteProvider`: it only takes over when the cursor sits inside a `$` mention token, otherwise it delegates to the original (commands, files, `@`-paths …).
- **发现**复用 pi 会话中已加载的 skill;首轮回退到 pi 导出的 `loadSkills`。
- **展开**在 `input` 事件(`transform`)中完成,因此 `$` 在每一轮、任意位置都生效 —— 绕开了 pi 原生 `/skill:` 仅开头单次的限制。
- **补全**通过 `ctx.ui.addAutocompleteProvider` 包装 pi 内置 provider:仅在光标位于 `$` 引用 token 内时接管,否则透传给原生(命令、文件、`@`-路径等)。

---

## 🧪 Development / 开发

```bash
npm install
npm test          # unit tests (expansion + autocomplete)
npm run typecheck
npm run build
npm pack          # inspect publish contents
```

## 📦 Gallery preview

The image below is what shows up on the [pi.dev package gallery](https://pi.dev/):

<p align="center">
  <img alt="pi.dev gallery card" src="https://raw.githubusercontent.com/WufeiHalf/pi-skills-mention/master/media/poster.png" width="640">
</p>

---

## License / 许可证

MIT

[Codex]: https://openai.com/codex
[Pi coding agent]: https://pi.dev
