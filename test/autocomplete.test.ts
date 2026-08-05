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
});
