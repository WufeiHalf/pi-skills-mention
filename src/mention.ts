/**
 * `$skill-name` mention expansion for pi.
 *
 * Given raw user input and a map of known skills, replace `$<token>` mentions
 * with the full skill instructions.
 *
 * Two output shapes:
 *   - **Official (collapsible):** when the whole message *starts* with a single
 *     `$skill` mention, we emit pi's native `<skill ...>...</skill>` block and
 *     join any trailing user text with `\n\n`. This byte-for-byte matches what
 *     pi's own `_expandSkillCommand` produces for `/skill:name`, so the TUI's
 *     `parseSkillBlock` detects it and renders the collapsible `[skill]` card
 *     (purple tag + name + `ctrl+o to expand`).
 *   - **Inline:** otherwise every `$skill` anywhere in the message is expanded
 *     in place (multiple skills, mid-sentence mentions). pi cannot fold these
 *     (its collapsing only understands a whole-message-single-skill block), so
 *     the skill text is shown directly — but it still works.
 *
 * Matching rules (kept predictable and safe):
 *   - A mention is a `$` immediately followed by `[a-z0-9-]+`.
 *   - Resolve greedily to the *longest* known skill name that is a prefix
 *     (`$code-review-module` prefers `code-review-module` over `code-review`).
 *   - Unknown tokens (`$PATH`, `$HOME`, `$(cmd)`) stay literal.
 *   - `$$name` is the escape hatch → literal `$name`.
 */

import type { MentionSkill } from "./skill-registry.js";
import { buildSkillBlock } from "./skill-registry.js";

export interface ExpandResult {
  text: string;
  /** Names of the skills that were expanded, in first-mention order. */
  expanded: string[];
  /** True when the output matches pi's official collapsible single-skill shape. */
  official: boolean;
}

const MENTION_TOKEN = /(\$+)([a-z0-9][a-z0-9-]*)/g;
/** Leading `$skill` (the very first thing in the message). */
const LEADING_MENTION = /^\$([a-z0-9][a-z0-9-]*)/;

export function expandMentions(input: string, skills: Map<string, MentionSkill>): ExpandResult {
  if (!input.includes("$") || skills.size === 0) {
    return { text: input, expanded: [], official: false };
  }

  // Fast path: message begins with a single $skill mention and contains no
  // other mention tokens anywhere. Emit the official collapsible shape.
  const lead = LEADING_MENTION.exec(input);
  if (lead) {
    const leadSkill = resolveLongestMatch(lead[1], skills);
    if (leadSkill && !containsAnotherMention(input, lead[0])) {
      const block = buildSkillBlockSafe(leadSkill);
      const rest = input.slice(lead[0].length).trim();
      const text = rest ? `${block}\n\n${rest}` : block;
      return { text, expanded: [leadSkill.name], official: true };
    }
  }

  // General path: expand every mention in place.
  const expandedNames: string[] = [];
  const seen = new Set<string>();

  const result = input.replace(MENTION_TOKEN, (whole, signs: string, token: string) => {
    const signCount = signs.length;

    // Escape hatch: every pair of `$` collapses to one literal `$`.
    if (signCount % 2 === 0) {
      return `${"$".repeat(signCount / 2)}${token}`;
    }

    const literalDollars = "$".repeat((signCount - 1) / 2);
    const skill = resolveLongestMatch(token, skills);
    if (!skill) {
      return `${literalDollars}${whole.replace(/^\$+/, "$")}`;
    }

    if (!seen.has(skill.name)) {
      seen.add(skill.name);
      expandedNames.push(skill.name);
    }
    return `${literalDollars}${buildSkillBlockSafe(skill)}`;
  });

  return { text: result, expanded: expandedNames, official: false };
}

/**
 * True if `input`, after consuming `lead` (the leading `$skill`), still has
 * another `$name`-style token dangling somewhere (which the one-block official
 * parser can't fold).
 */
function containsAnotherMention(input: string, lead: string): boolean {
  const rest = input.slice(lead.length);
  return MENTION_TOKEN.test(rest);
}

/** Find the longest known skill whose name is a prefix of `token`. */
function resolveLongestMatch(token: string, skills: Map<string, MentionSkill>): MentionSkill | null {
  let candidate = token;
  while (candidate.length > 0) {
    const skill = skills.get(candidate);
    if (skill) return skill;
    const idx = candidate.lastIndexOf("-");
    if (idx <= 0) break;
    candidate = candidate.slice(0, idx);
  }
  return null;
}

function buildSkillBlockSafe(skill: MentionSkill): string {
  try {
    return buildSkillBlock(skill);
  } catch {
    return `$` + skill.name; // unreadable skill — keep literal mention
  }
}
