/**
 * `$`-triggered skill autocompletion for pi's TUI input editor.
 *
 * Wraps the existing autocomplete provider so that when the cursor sits inside
 * a `$<partial>` token, we present the list of mention-addressable skills
 * instead of the default file/command completions. All other contexts
 * delegate to the wrapped provider unchanged.
 */

import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@earendil-works/pi-tui";
import { fuzzyFilter } from "@earendil-works/pi-tui";
import type { MentionSkill } from "./skill-registry.js";

/** Regex for the token a skill mention is being typed in: `$[a-z0-9-]*`. */
const MENTION_AT_CURSOR = /\$([a-z0-9-]*)$/;

export interface MentionAutocompleteOptions {
  /** Live skill index; re-resolved each call so new skills appear without reload. */
  getSkills(): Map<string, MentionSkill>;
}

export function createMentionAutocompleteProvider(inner: AutocompleteProvider, opts: MentionAutocompleteOptions): AutocompleteProvider {
  return {
    triggerCharacters: ["$"],

    async getSuggestions(
      lines: string[],
      cursorLine: number,
      cursorCol: number,
      options: { signal: AbortSignal; force?: boolean },
    ): Promise<AutocompleteSuggestions | null> {
      const currentLine = lines[cursorLine] ?? "";
      const beforeCursor = currentLine.slice(0, cursorCol);

      const match = MENTION_AT_CURSOR.exec(beforeCursor);
      if (match) {
        const partial = match[1].toLowerCase();
        if (partial === "") {
          // Bare `$`: show the full list (best matches first).
          const all: MentionSkill[] = [...opts.getSkills().values()];
          if (all.length === 0) return null;
          return { items: all.map((s) => toItem(s)), prefix: "$" };
        }

        // Fuzzy match: every query char appears in order in the skill name
        // (not necessarily consecutive), so $impv matches improve-codebase.
        // Prefix matches are ranked ahead of weaker substring matches.
        const ranked = fuzzyFilter([...opts.getSkills().values()], partial, (s) => s.name.toLowerCase());
        // Split ranked results into prefix matches (front) and other fuzzy
        // matches, so an exact-prefix skill wins over a looser substring hit.
        const prefixHits: AutocompleteItem[] = [];
        const fuzzyHits: AutocompleteItem[] = [];
        for (const s of ranked) {
          const item: AutocompleteItem = toItem(s);
          if (s.name.toLowerCase().startsWith(partial)) prefixHits.push(item);
          else fuzzyHits.push(item);
        }
        const items = [...prefixHits, ...fuzzyHits];
        if (items.length === 0) return null;
        return { items, prefix: `$${match[1]}` };
      }

      // Not a `$` mention — delegate to the wrapped provider.
      return inner.getSuggestions(lines, cursorLine, cursorCol, options);
    },

    applyCompletion(
      lines: string[],
      cursorLine: number,
      cursorCol: number,
      item: AutocompleteItem,
      prefix: string,
    ) {
      const currentLine = lines[cursorLine] ?? "";
      const beforePrefix = currentLine.slice(0, cursorCol - prefix.length);
      const afterCursor = currentLine.slice(cursorCol);
      const newLine = `${beforePrefix}${item.value}${afterCursor}`;
      const newLines = [...lines];
      newLines[cursorLine] = newLine;
      return {
        lines: newLines,
        cursorLine,
        cursorCol: beforePrefix.length + item.value.length,
      };
    },
  };
}

function toItem(skill: MentionSkill): AutocompleteItem {
  return { value: `$${skill.name}`, label: `$${skill.name}`, description: describeSkill(skill) };
}

function describeSkill(skill: MentionSkill): string {
  const path = skill.filePath.replace(/(^|\/)(SKILL\.md|\w+\.md)$/i, "");
  return `skill${path ? ` · ${path}` : ""}`;
}
