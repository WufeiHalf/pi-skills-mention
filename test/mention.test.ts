import { afterAll, describe, it, expect } from "vitest";
import { scanMentions } from "../src/mention.js";
import { buildInlineSkillsContent } from "../src/skill-registry.js";
import type { MentionSkill } from "../src/skill-registry.js";

// Minimal skill blocks — the builder reads SKILL.md content, so tests point
// filePath at a temp file we control.
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

describe("scanMentions", () => {
  const tdd = skill("tdd");
  const codeReview = skill("code-review");

  function index(...skills: MentionSkill[]): Map<string, MentionSkill> {
    return new Map(skills.map((s) => [s.name, s]));
  }

  it("finds a single mention anywhere in the text", () => {
    const found = scanMentions("帮我 $tdd 做这个", index(tdd));
    expect(found.map((s) => s.name)).toEqual(["tdd"]);
  });

  it("finds multiple mentions in first-mention order", () => {
    const found = scanMentions("$tdd 然后 $code-review", index(tdd, codeReview));
    expect(found.map((s) => s.name)).toEqual(["tdd", "code-review"]);
  });

  it("finds mid-sentence mentions", () => {
    const found = scanMentions(
      "现在的情况是这样的，从agent 的架构上，可以多做一点 $tdd 和 $code-review 学习下",
      index(tdd, codeReview),
    );
    expect(found.map((s) => s.name)).toEqual(["tdd", "code-review"]);
  });

  it("ignores non-skill $ tokens (e.g. $PATH, $VAR)", () => {
    expect(scanMentions("echo $PATH is fine", index(tdd))).toEqual([]);
  });

  it("returns nothing when no skills are known", () => {
    expect(scanMentions("帮我 $tdd 做这个", index())).toEqual([]);
  });

  it("ignores the $$ escape as a literal $name", () => {
    expect(scanMentions("$$tdd 保持老实", index(tdd))).toEqual([]);
  });

  it("resolves the longest known skill prefix for dashed names", () => {
    const reviewModule = skill("code-review-module");
    const found = scanMentions("$code-review-module", index(codeReview, reviewModule));
    expect(found.map((s) => s.name)).toEqual(["code-review-module"]);
  });

  it("dedupes repeated mentions of the same skill", () => {
    const found = scanMentions("$tdd 还有 $tdd", index(tdd));
    expect(found.map((s) => s.name)).toEqual(["tdd"]);
  });

  it("never rewrites the input text (prompt stays as typed)", () => {
    const input = "$tdd 帮我实现";
    const found = scanMentions(input, index(tdd));
    expect(found.map((s) => s.name)).toEqual(["tdd"]);
    expect(input).toBe("$tdd 帮我实现");
  });
});

describe("buildInlineSkillsContent", () => {
  const tdd = skill("tdd");
  const codeReview = skill("code-review");

  it("builds one <skill> block per skill with pi's native format", () => {
    const { content, blocks } = buildInlineSkillsContent([tdd, codeReview]);
    expect(content).toContain("<inline_skills>");
    expect(content).toContain("already loaded");
    expect((content.match(/<skill name="/g) ?? []).length).toBe(2);
    expect(content).toContain(`<skill name="tdd" location="${tdd.filePath}">`);
    expect(content).toContain(`References are relative to ${tdd.baseDir}.`);
    expect(content).toContain("用 tdd 的规则处理");
    expect(content).toContain("用 code-review 的规则处理");
    expect(content).toContain("</inline_skills>");

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ name: "tdd", location: tdd.filePath });
    expect(blocks[1]).toMatchObject({ name: "code-review", location: codeReview.filePath });
    expect(blocks[0].content).toContain("用 tdd 的规则处理");
  });

  it("strips skill frontmatter from the injected body", () => {
    const s = skill("frontmatter-skill", "正文内容");
    const { content } = buildInlineSkillsContent([s]);
    expect(content).not.toContain("description: test");
    expect(content).toContain("正文内容");
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
