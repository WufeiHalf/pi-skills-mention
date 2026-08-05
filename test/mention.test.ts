import { afterAll, describe, it, expect } from "vitest";
import { expandMentions } from "../src/mention.js";
import type { MentionSkill } from "../src/skill-registry.js";

// Minimal skill blocks — the expansion wraps SKILL.md content. In tests we
// point filePath at a temp file we control so the block can be read.
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

function makeSkill(name: string, body: string): MentionSkill {
  const dir = mkdtempSync(join(tmpdir(), "pi-skills-mention-"));
  const filePath = join(dir, "SKILL.md");
  writeFileSync(filePath, `---\nname: ${name}\ndescription: test\n---\n${body}`, "utf8");
  return { name, filePath, baseDir: dir };
}

let cleanup: string[] = [];
function skill(name: string, body = `# ${name}\n用 ${name} 的规则处理。`): MentionSkill {
  const s = makeSkill(name, body);
  cleanup.push(dirname(s.filePath));
  return s;
}

describe("expandMentions", () => {
  const tdd = skill("tdd");
  const codeReview = skill("code-review");

  function index(...skills: MentionSkill[]): Map<string, MentionSkill> {
    return new Map(skills.map((s) => [s.name, s]));
  }

  it("expands a single mention anywhere in the text", () => {
    const res = expandMentions("帮我 $tdd 做这个", index(tdd));
    expect(res.expanded).toEqual(["tdd"]);
    expect(res.text).toContain("<skill name=\"tdd\"");
    expect(res.text).toContain("用 tdd 的规则处理");
    expect(res.text).not.toContain("$tdd");
  });

  it("expands multiple mentions in one message", () => {
    const res = expandMentions("$tdd 然后 $code-review", index(tdd, codeReview));
    expect(res.expanded).toEqual(["tdd", "code-review"]);
    expect(res.text).toContain("<skill name=\"code-review\"");
    // Every mention replaced
    expect(res.text).not.toContain("$tdd");
    expect(res.text).not.toContain("$code-review");
  });

  it("leaves non-skill $ tokens untouched (e.g. $PATH, $VAR)", () => {
    const res = expandMentions("echo $PATH is fine", index(tdd));
    expect(res.text).toBe("echo $PATH is fine");
    expect(res.expanded).toEqual([]);
  });

  it("does not expand when no skills are known", () => {
    const res = expandMentions("帮我 $tdd 做这个", index());
    expect(res.text).toBe("帮我 $tdd 做这个");
    expect(res.expanded).toEqual([]);
  });

  it("respects the $$ escape as a literal $name", () => {
    const res = expandMentions("$$tdd 保持老实", index(tdd));
    expect(res.text).toBe("$tdd 保持老实");
    expect(res.expanded).toEqual([]);
  });

  it("resolves the longest known skill prefix for dashed names", () => {
    const reviewModule = skill("code-review-module");
    const res = expandMentions("$code-review-module", index(codeReview, reviewModule));
    expect(res.expanded).toEqual(["code-review-module"]);
    expect(res.text).toContain("<skill name=\"code-review-module\"");
  });

  it("dedupes repeated mentions of the same skill", () => {
    const res = expandMentions("$tdd 还有 $tdd", index(tdd));
    expect(res.expanded).toEqual(["tdd"]);
    expect((res.text.match(/<skill name="tdd"/g) ?? []).length).toBe(2);
  });

  afterAll(() => {
    for (const dir of cleanup) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });
});
