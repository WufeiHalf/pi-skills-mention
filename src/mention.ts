/**
 * `$skill-name` mention scanning for pi.
 *
 * pi-skills-mention never rewrites the user's prompt: the text pi stores and
 * displays is exactly what the user typed (so `/fuck`-style recovery, rewind
 * and re-editing keep working on the original `$skill` mentions). Instead we
 * *scan* the input for known `$skill` mentions and the extension injects the
 * skill contents as a separate custom message when the agent starts.
 *
 * Matching rules (kept predictable and safe):
 *   - A mention is a `$` immediately followed by `[a-z0-9-]+`.
 *   - Resolve greedily to the *longest* known skill name that is a prefix
 *     (`$code-review-module` prefers `code-review-module` over `code-review`).
 *   - Unknown tokens (`$PATH`, `$HOME`, `$(cmd)`) are ignored.
 *   - `$$name` is the escape hatch — never treated as a mention.
 */

import type { MentionSkill } from "./skill-registry.js";

const MENTION_TOKEN = /(\$+)([a-z0-9][a-z0-9-]*)/g;

/**
 * Scan `input` for known `$skill` mentions. Returns the mentioned skills in
 * first-mention order, deduplicated. The input text itself is never modified.
 */
export function scanMentions(input: string, skills: Map<string, MentionSkill>): MentionSkill[] {
  if (!input.includes("$") || skills.size === 0) return [];

  const found: MentionSkill[] = [];
  const seen = new Set<string>();

  input.replace(MENTION_TOKEN, (_whole, signs: string, token: string) => {
    // Even `$` count = escape hatch (`$$name` → literal `$name`), not a mention.
    if (signs.length % 2 === 0) return _whole;
    const skill = resolveLongestMatch(token, skills);
    if (skill && !seen.has(skill.name)) {
      seen.add(skill.name);
      found.push(skill);
    }
    return _whole;
  });

  return found;
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
