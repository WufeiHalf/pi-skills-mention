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
        const partial = match[1];
        const items: AutocompleteItem[] = [];
        for (const [name, skill] of opts.getSkills()) {
          if (!name) continue;
          if (!name.toLowerCase().startsWith(partial.toLowerCase())) continue;
          items.push({ value: `$${name}`, label: `$${name}`, description: describeSkill(skill) });
        }
        if (items.length === 0) return null;
        return { items, prefix: `$${partial}` };
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

function describeSkill(skill: MentionSkill): string {
  const path = skill.filePath.replace(/(^|\/)(SKILL\.md|\w+\.md)$/i, "");
  return `skill${path ? ` · ${path}` : ""}`;
}
