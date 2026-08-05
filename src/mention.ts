/**
 * `$skill-name` mention expansion for pi.
 *
 * Given raw user input and a map of known skills, replace every `$<token>`
 * whose leading prefix is a known skill name with the full skill block.
 *
 * Matching rules (kept predictable and safe):
 *   - A mention is a `$` immediately followed by `[a-z0-9-]+`.
 *   - The token is resolved greedily to the *longest* known skill name that is
 *     a prefix of it (so `$code-review-module` uses `code-review` when it is
 *     the only match, or `code-review-module` itself when it exists).
 *   - If no known skill matches, the `$token` is left untouched (`$PATH` etc.
 *     pass through — shell variables in ordinary text are unaffected).
 *   - `$$name` is the escape hatch: it renders as a literal `$name`.
 */

import type { MentionSkill } from "./skill-registry.js";

export interface ExpandResult {
  text: string;
  /** Names of the skills that were expanded, in first-mention order. */
  expanded: string[];
}

const MENTION_TOKEN = /(\$+)([a-z0-9][a-z0-9-]*)/g;

export function expandMentions(input: string, skills: Map<string, MentionSkill>): ExpandResult {
  if (!input.includes("$") || skills.size === 0) {
    return { text: input, expanded: [] };
  }

  const expandedNames: string[] = [];
  const seen = new Set<string>();

  const result = input.replace(MENTION_TOKEN, (whole, signs: string, token: string) => {
    const signCount = signs.length;

    // Escape hatch: every pair of `$` collapses to one literal `$`. An even
    // run (`$$name`) means none of these `$` trigger a mention.
    if (signCount % 2 === 0) {
      return `${"$".repeat(signCount / 2)}${token}`;
    }

    // Odd run: drop the leading literal pairs, the final `$` is the mention.
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

  return { text: result, expanded: expandedNames };
}

/** Find the longest known skill whose name is a prefix of `token`. */
function resolveLongestMatch(token: string, skills: Map<string, MentionSkill>): MentionSkill | null {
  // Check full token first, then strip trailing pathlet chunks to find a known
  // skill prefix. Because skill tokens are lowercase+dashes, we can safely
  // shorten at hyphen boundaries.
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
    return buildSkillBlockUnsafe(skill);
  } catch {
    return `$` + skill.name; // unreadable skill — keep literal mention
  }
}

// Imported lazily to keep this module pure-ish; the registry is the single
// place that reads files.
import { buildSkillBlock as buildSkillBlockUnsafe } from "./skill-registry.js";
