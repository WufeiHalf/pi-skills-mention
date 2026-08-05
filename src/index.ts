/**
 * pi-skills-mention — Codex-style `$skill-name` mentions for pi.
 *
 * Adds two things to pi:
 *
 *  1. **Runtime expansion.** Any `$skill-name` written anywhere in a prompt
 *     (not just at the start) is replaced with the skill's full instructions
 *     before the agent runs. You can mention many skills in one message, mix
 *     them with ordinary text, and re-mention in later turns:
 *
 *         $code-review 与 $humanize 帮我审查今天下午改的 auth 模块，并把结论润色成人话。
 *
 *  2. **TUI autocompletion.** Type `$` in the input editor and a live list of
 *     mentionable skills appears, filtered as you type — Codex's `$` feel.
 *
 * Escape hatch: `$$name` renders as a literal `$name`.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { captureSessionSkills, getMentionSkills } from "./discover.js";
import { expandMentions } from "./mention.js";
import { createMentionAutocompleteProvider } from "./autocomplete.js";

export default function (pi: ExtensionAPI) {
  let cwd = process.cwd();

  // Capture pi's authoritative skill set every turn so expansion + autocomplete
  // stay in sync with what pi already injected into the system prompt.
  pi.on("before_agent_start", async (event, ctx) => {
    cwd = ctx.cwd || cwd;
    captureSessionSkills(event.systemPromptOptions?.skills);
  });

  // Expand `$skill-name` mentions in user input, wherever they appear.
  pi.on("input", async (event, ctx) => {
    cwd = ctx.cwd || cwd;
    const skills = getMentionSkills(cwd);
    if (skills.size === 0) return; // pass through

    const { text, expanded } = expandMentions(event.text, skills);
    if (expanded.length === 0 || text === event.text) return; // nothing to expand

    if (process.env.PI_SKILLS_MENTION_DEBUG) {
      console.error(`[pi-skills-mention] expanded ${expanded.join(", ")}`);
    }
    return { action: "transform", text };
  });

  // Register the `$`-triggered skill autocomplete once the session is up. The
  // provider wrapper is registered once per session and re-resolves the skill
  // index live, so newly added skills appear without a restart. Guarded to
  // interactive/RPC callers that actually host an editor autocomplete.
  let autocompleteInstalled = false;
  pi.on("session_start", async (_event, ctx) => {
    if (autocompleteInstalled) return;
    if (ctx.mode !== "tui" && ctx.mode !== "rpc") return;
    autocompleteInstalled = true;
    try {
      ctx.ui.addAutocompleteProvider((current) =>
        createMentionAutocompleteProvider(current, {
          getSkills: () => getMentionSkills(ctx.cwd),
        }),
      );
    } catch {
      // Editor host not available in this mode — expansion still works.
    }
  });
}
