# pi-skills-mention(中文文档)

> **Codex 风格的 `$` skill 引用** —— 输入 `$` 拉起 skill 列表,任意位置、一次多个地引用技能。

<p align="center">
  <img alt="pi-skills-mention 演示" src="https://raw.githubusercontent.com/WufeiHalf/pi-skills-mention/master/media/poster.png" width="720">
</p>

**pi-skills-mention** 为 [Pi coding agent](https://pi.dev) 带来 [Codex](https://openai.com/codex) 风格的 `$` skill 引用。不再需要记 `/skill:name`(它只能在消息**开头**、一次只展开一个),你在任意一条消息的**任意位置**写下 `$` + skill 名即可:

```
用 $code-review 审查这段代码，再用 $humanize 润色结论
```

在输入框敲下 `$`,skill 列表**立刻**弹出 —— 边输入边过滤,回车即选中,一次可引用多个。和 Codex 手感一致。

> [**English README** → `README.md`](README.md)

---

## ✨ 特性

- **`$` 任意位置** —— 在消息中间或末尾引用 skill,不限于开头。
- **一次多个** —— `$code-review $humanize` 在一条消息里加载任意多个 skill。
- **即时补全** —— 敲 `$` 立即弹出 skill 列表,实时输入过滤。
- **默认安全** —— 只有*已知* skill 名才会加载;`$PATH`、`$FOO`、`$(cmd)` 等原样保留。
- **原文永不改写** —— pi 存储与显示的始终是你输入的原样文本(`$skill` 标记保留),`/fuck` 回退、rewind、重新编辑都看到你的原始输入。
- **转义兜底** —— `$$name` 输出字面 `$name`。

---

## 安装

```bash
pi install npm:pi-skills-mention
```

开发时可用源码运行:

```bash
pi -e /path/to/pi-skills-mention/src/index.ts
```

安装后重启 pi(或 `/reload`),在输入框敲 `$` 即可体验。

---

## 用法

任意位置、按名字引用任意多个 skill:

```
$tdd 实现这个功能
先审查 $code-review 再提交
帮我把这份总结 $humanize 一下，顺便 $rewrite 精简
$code-review 与 $humanize 帮我审查 auth 模块的改动，并把结论润色成自然的中文。
```

每个 `$skill-name` 会在 agent 运行前加载该 skill 的完整 `SKILL.md` 指令 —— 与 pi 原生 `/skill:name` 生成的 `<skill ...>` 块一致。你的**原文永远不会被改写**:pi 存储与显示的始终是你输入的内容(带 `$skill` 标记),skill 内容作为一条独立上下文消息注入。TUI 里它显示为一行紧凑的 `✦ skills-mention: 名字 + 名字 (ctrl+o to expand)`,展开可查看完整 skill 内容。

因为存储的 prompt 就是你的原文,`/fuck`(pi-wtf)、rewind、回退编辑等恢复类功能拿到的都是你原本的 `$skill` 引用 —— 输入框里不会出现大段 skill 文本。

**自动补全:** 敲下 `$`,skill 选择器立刻弹出完整列表。继续输入可实时过滤;回车(或方向键 + 回车)插入选中的 `$skill-name`。

### 使用注意

- **加载展示** —— 引用的 skill 在聊天里显示为一行紧凑提示(`✦ skills-mention: a + b`,`ctrl+o` 展开完整内容)。同一会话分支已加载过的 skill 不会重复注入。
- **模糊补全** —— `$` 的匹配是模糊的,不只是前缀匹配:`$impv` 也能命中 `improve-codebase` 这类 skill(字母按顺序出现即可,不必连续)。前缀完全匹配的仍排最前。
- 采用**最长匹配**:若同时存在 `code-review` 和 `code-review-module`,`$code-review-module` 会命中更长那个。
- 不是已知 skill 的 token 原样保留 —— `$HOME`、`$PATH`、`$(cmd)` 不受影响。
- 用 `$$name` 强制输出字面 `$name`。
- skill 名单来自 pi 会话中已加载的集合(`systemPromptOptions.skills`,每轮同步);首轮回退到 pi 自身的发现逻辑(`~/.pi/agent/skills`、`<cwd>/.pi/skills`、`~/.agents/skills`、以及祖先目录的 `.agents/skills`)。

---

## 工作原理

| 模块 | 职责 |
| --- | --- |
| `src/mention.ts` | `$token` → skill 块展开 |
| `src/autocomplete.ts` | `$` 触发的补全 provider 包装 |
| `src/discover.ts` | 会话 skill 缓存 + 首轮发现 |
| `src/skill-registry.ts` | skill 索引 + 块构建 |

- **发现**复用 pi 会话中已加载的 skill;首轮回退到 pi 导出的 `loadSkills`。
- **展开**在 `input` 事件(`transform`)中完成,因此 `$` 在每一轮、任意位置都生效 —— 绕开了 pi 原生 `/skill:` 仅开头单次的限制。
- **补全**通过 `ctx.ui.addAutocompleteProvider` 包装 pi 内置 provider:仅在光标位于 `$` 引用 token 内时接管,否则透传给原生(命令、文件、`@`-路径等)。**原生 `/` 命令和 `/skill:` 不会被禁用** —— `$` 只是新增,不替换。

---

## 开发

```bash
npm install
npm test          # 单元测试(展开 + 补全)
npm run typecheck
npm run build
npm pack          # 检查发布内容
```

## 图库预览

下图会显示在 [pi.dev 的包图库](https://pi.dev/)上:

<p align="center">
  <img alt="pi.dev 图库卡片" src="https://raw.githubusercontent.com/WufeiHalf/pi-skills-mention/master/media/poster.png" width="640">
</p>

---

## License / 许可证

MIT
