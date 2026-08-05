/**
 * Shared skill resolution helpers for pi-skills-mention.
 */

import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Skill } from "@earendil-works/pi-coding-agent";

/** A skill that is mention-addressable by name. */
export interface MentionSkill {
  name: string;
  filePath: string;
  baseDir: string;
}

/**
 * Build the `<skill ...>` block pi injects for a `$name` mention — mirrors the
 * format `AgentSession._expandSkillCommand` uses, so downstream parsing of
 * skill blocks (collapsible rendering, etc.) keeps working.
 *
 * Throws if the SKILL.md cannot be read.
 */
export function buildSkillBlock(skill: MentionSkill): string {
  const content = readFileSync(skill.filePath, "utf-8");
  const body = stripFrontmatterSafe(content).trim();
  return `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${body}\n</skill>`;
}

function stripFrontmatterSafe(content: string): string {
  // Strip a leading `---\n ... \n---\n` frontmatter block if present.
  const match = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(content);
  if (match) {
    return content.slice(match[0].length);
  }
  return content;
}

/**
 * Index a set of loaded skills keyed by their `name`. Skills without a name
 * are skipped. `baseDir` falls back to the parent of `filePath`.
 */
export function indexSkills(skills: readonly Skill[] | undefined): Map<string, MentionSkill> {
  const map = new Map<string, MentionSkill>();
  for (const s of skills ?? []) {
    if (!s.name) continue;
    const baseDir = s.baseDir || dirname(s.filePath);
    map.set(s.name, { name: s.name, filePath: s.filePath, baseDir });
  }
  return map;
}
