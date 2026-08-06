# AGENTS.md — pi-skills-mention 工作流

本项目是 pi 扩展包 **pi-skills-mention**：在 pi 输入框里用 Codex 风格的 `$skill-name`
引用 skill（任意位置、一次多个），输入 `$` 拉起 skill 自动补全列表。

本文件给后续会话使用：新会话接手前先读它，遵循下面的开发/发布流程与约定，别自己发明流程。

## 仓库与发布物

- 源码仓库：`/home/wufei/Desktop/privatecode/pi-skills-mention`，分支 `master`
  - remote：`git@github.com:WufeiHalf/pi-skills-mention.git`
  - GitHub Releases：https://github.com/WufeiHalf/pi-skills-mention/releases
- npm 包：`pi-skills-mention`（scope 公开包，owner `wufei`），pi.dev 展示页由 pi.dev 自动抓取
- 全局安装位置（本机 pi 实际加载的版本）：
  - `~/.pi/agent/npm/node_modules/pi-skills-mention/`
  - 由 `~/.pi/agent/settings.json` 里的 `npm:pi-skills-mention` 引用
- npm 发布凭据：`~/.npmrc` 里的 `//registry.npmjs.org/:_authToken=...`（bypass-2FA 的 token，
  勿提交进仓库、勿贴到对话里）

## 开发流程

1. **改动**：核心代码在 `src/`（`mention.ts` 展开逻辑、`autocomplete.ts` 补全、
   `discover.ts` skill 发现、`skill-registry.ts` 共享构建）。
2. **本地自测三件套**（发布前必跑，全绿才算过）：
   ```bash
   npm test          # vitest（test/ 下有 mention.test.ts / autocomplete.test.ts）
   npm run typecheck # tsc --noEmit
   npm run build     # tsc 产出 dist/
   ```
3. **真机冒烟**（改动涉及运行时行为时必做）：在 `/tmp/xxx` 下建
   `.agents/skills/<name>/SKILL.md`，开一个 pi 会话验证 `$mention` 真实展开；
   涉及 TUI 渲染的（折叠卡片等）要在真实 TUI 里看效果，单测不够。
4. **文档同步**：README 双语文档（`README.md` 英文为主 + `README.zh.md` 中文），
   行为/用法变化要两边一起更新。
5. 测试用的临时脚本用完即删（历史上有 `scripts/_smoke.mjs` 这类，测完清掉）。

## 发布流程（每发一版走一遍）

顺序固定：**检查 → 升版本 → 发 npm → commit/push → tag → GitHub Release → 更新全局 pi 扩展 → 验证**。

```bash
cd /home/wufei/Desktop/privatecode/pi-skills-mention

# 1. 三件套全绿（上面开发流程第 2 步）

# 2. 升版本号：改 package.json 的 "version"（package-lock 会随 npm install/publish 同步）
#    —— 版本号用语义化，commit message 用 "chore: bump to X.Y.Z (简短说明)"

# 3. 发 npm（prepublishOnly 钩子会自动再跑 typecheck+test+build，失败则中止发布）
npm publish --access public
#    验证：curl -s https://registry.npmjs.org/pi-skills-mention/latest

# 4. 提交 + 推送（git 身份固定用 wufei，别用机器默认身份）
git add -A
git -c user.name="wufei" -c user.email="wufei@local" commit -q -m "<type>: <一句话说明>"
git push origin master

# 5. 打 tag + 推 tag
git tag vX.Y.Z
git push origin vX.Y.Z

# 6. 建 GitHub Release（notes 写变更要点，bullet 形式，中英皆可）
gh release create vX.Y.Z --title "vX.Y.Z" --notes "..." --repo WufeiHalf/pi-skills-mention
#    验证：gh release list --repo WufeiHalf/pi-skills-mention

# 7. 更新本机全局 pi 扩展（让当前环境的 pi 用上新版本）
pi update --extension npm:pi-skills-mention
#    验证：node -e "console.log(require('/home/wufei/.pi/agent/npm/node_modules/pi-skills-mention/package.json').version)"

# 8. 冒烟：在 /tmp 起一个带测试 skill 的会话，确认新行为在真实 pi 里生效
```

版本历史（参考）：v0.1.0（首个公开版）→ v0.1.1..v0.1.4（README 拆分、模糊补全、
/command 兼容修复、官方折叠卡片）。每次发版都包含一次 "bump + 发 npm + tag + release + 全局更新"。

## 包结构约定（改动时保持）

- `package.json` 的 `pi.extensions` 指向 `./src/index.ts`（TS 源码直出，dist 仅用于发布）
- `files` 白名单：`src/`、`dist/`、两个 README
- `peerDependencies`：`@earendil-works/pi-coding-agent` / `pi-tui` >= 0.83.0
- `media/preview.png`、`media/poster.png`：pi.dev 画廊图，URL 用 `master` 分支的 raw 链接
- README 底部保留 pi.dev 画廊卡片图片

## 关键机制备忘（改行为前必读）

- **原文永不改写**：`input` 事件只扫描 `$mention`（`scanMentions`），返回 `{action: "transform", text: event.text}`
  原样文本 —— pi 存储/显示/恢复的都是用户输入的原样内容，所以 `/fuck`（pi-wtf）、rewind、
  回退编辑天然兼容。不要改回“把 skill 内容写进消息文本”，那会让输入框/历史出现大段文本。
- **内容注入**：`before_agent_start` 把待注入的 skills 构建成 `<inline_skills>...</inline_skills>`
  （customType `skills-mention`）作为 custom message 返回，模型上下文拿到完整内容，
  TUI 由 `registerMessageRenderer` 渲染成一行紧凑提示（ctrl+o 展开完整块）。
- **去重**：`loadedSkillNames` 从 session 分支的 `custom_message` 条目恢复（`restoreLoadedSkills`），
  同一分支已注入的 skill 不重复注入。
- **块格式**：skill 块沿用 pi 原生 `/skill:name` 的格式
  （`<skill name="..." location="...">\nReferences are relative to ...\n\n<body>\n</skill>`），
  保证与 pi 的 skill 渲染/解析一致。
