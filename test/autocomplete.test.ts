import { describe, it, expect } from "vitest";
import { createMentionAutocompleteProvider } from "../src/autocomplete.js";
import type { AutocompleteProvider, AutocompleteItem } from "@earendil-works/pi-tui";
import type { MentionSkill } from "../src/skill-registry.js";

const tdd: MentionSkill = { name: "tdd", filePath: "/skills/tdd/SKILL.md", baseDir: "/skills/tdd" };
const codeReview: MentionSkill = { name: "code-review", filePath: "/skills/code-review/SKILL.md", baseDir: "/skills/code-review" };

function index(...skills: MentionSkill[]): Map<string, MentionSkill> {
  return new Map(skills.map((s) => [s.name, s]));
}

function makeInner(): AutocompleteProvider {
  return {
    getSuggestions: async () => {
      throw new Error("delegate should not be called in a $ mention context");
    },
    applyCompletion: (lines, cursorLine, cursorCol, item: AutocompleteItem, prefix) => {
      const line = lines[cursorLine] ?? "";
      const before = line.slice(0, cursorCol - prefix.length);
      const after = line.slice(cursorCol);
      const newLines = [...lines];
      newLines[cursorLine] = `${before}${item.value}${after}`;
      return { lines: newLines, cursorLine, cursorCol: before.length + item.value.length };
    },
  };
}

/**
 * Mimics pi's real CombinedAutocompleteProvider applyCompletion for slash
 * commands: pi's suggestion `item.value` deliberately omits the leading `/`,
 * and native applyCompletion re-adds it (plus a trailing space). If our
 * wrapper wrongly intercepts these, the `/` is dropped.
 */
function makeSlashInner(): AutocompleteProvider {
  return {
    getSuggestions: async () => null,
    applyCompletion: (lines, cursorLine, cursorCol, item: AutocompleteItem, prefix) => {
      const line = lines[cursorLine] ?? "";
      const beforePrefix = line.slice(0, cursorCol - prefix.length);
      const after = line.slice(cursorCol);
      const newLines = [...lines];
      newLines[cursorLine] = `${beforePrefix}/${item.value} ${after}`;
      return { lines: newLines, cursorLine, cursorCol: beforePrefix.length + item.value.length + 2 };
    },
  };
}

function suggestions(lines: string[], cursorCol: number, skills: Map<string, MentionSkill>) {
  const provider = createMentionAutocompleteProvider(makeInner(), { getSkills: () => skills });
  return provider.getSuggestions(lines, 0, cursorCol, { signal: new AbortController().signal });
}

describe("createMentionAutocompleteProvider", () => {
  it("declares $ as a trigger character", () => {
    const provider = createMentionAutocompleteProvider(makeInner(), { getSkills: () => index(tdd) });
    expect(provider.triggerCharacters).toContain("$");
  });

  it("shows all skills immediately for a bare $", async () => {
    const res = await suggestions(["$"], 1, index(tdd, codeReview));
    expect(res).not.toBeNull();
    expect(res!.prefix).toBe("$");
    expect(res!.items.map((i) => i.value).sort()).toEqual(["$code-review", "$tdd"]);
  });

  it("offers skills matching the partial after $", async () => {
    const res = await suggestions(["帮我 $cod 工作"], 7, index(tdd, codeReview));
    expect(res).not.toBeNull();
    expect(res!.prefix).toBe("$cod");
    const values = res!.items.map((i) => i.value);
    expect(values).toContain("$code-review");
    expect(values).not.toContain("$tdd");
  });

  it("returns nothing for an unmatched partial", async () => {
    const res = await suggestions(["帮我 $zzz 工作"], 7, index(tdd, codeReview));
    expect(res).toBeNull();
  });

  it("fuzzy-matches an abbreviation like $impv -> improve-codebase", async () => {
    const improve: MentionSkill = { name: "improve-codebase", filePath: "/skills/improve-codebase/SKILL.md", baseDir: "/skills/improve-codebase" };
    const res = await suggestions(["$impv"], 5, index(improve));
    expect(res).not.toBeNull();
    expect(res!.items.map((i) => i.value)).toContain("$improve-codebase");
  });

  it("ranks prefix matches ahead of weaker fuzzy hits", async () => {
    const codeReview: MentionSkill = { name: "code-review", filePath: "/skills/code-review/SKILL.md", baseDir: "/skills/code-review" };
    const improve: MentionSkill = { name: "improve-codebase", filePath: "/skills/improve-codebase/SKILL.md", baseDir: "/skills/improve-codebase" };
    const res = await suggestions(["$cod"], 4, index(codeReview, improve));
    expect(res).not.toBeNull();
    expect(res!.items.map((i) => i.value)).toEqual(["$code-review", "$improve-codebase"]);
  });

  it("applies a completion by replacing the $partial token", async () => {
    const provider = createMentionAutocompleteProvider(makeInner(), { getSkills: () => index(tdd, codeReview) });
    const lines = ["帮我 $cod 工作"];
    const item = { value: "$code-review", label: "$code-review" };
    // cursor right after "$cod" => col 7. prefix "$cod" replaces cols 3..7.
    const out = provider.applyCompletion(lines, 0, 7, item, "$cod");
    expect(out.lines[0]).toBe("帮我 $code-review 工作");
    // 2 CJK chars = 2 cols + 1 space = col3 for "$", plus "$code-review".length (12)
    expect(out.cursorCol).toBe(3 + 12);
  });

  it("delegates non-$ completions (native /commands) so the slash is preserved", async () => {
    // Regression: our wrapper used to intercept applyCompletion unconditionally,
    // dropping the leading "/" pi's native command suggestions omit and breaking
    // commands like /reload.
    const provider = createMentionAutocompleteProvider(makeSlashInner(), { getSkills: () => index(tdd) });
    const lines = ["/rel"];
    const out = provider.applyCompletion(lines, 0, 4, { value: "reload", label: "reload" }, "/rel");
    expect(out.lines[0]).toBe("/reload ");
  });

  it("delegates non-$ getSuggestions to the wrapped provider", async () => {
    const provider = createMentionAutocompleteProvider(makeSlashInner(), { getSkills: () => index(tdd) });
    const res = await provider.getSuggestions(["/rel"], 0, 4, { signal: new AbortController().signal });
    expect(res).toBeNull(); // makeSlashInner returns null; our wrapper must not rewrite /rel
  });
});
