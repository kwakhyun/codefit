import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "./store";
import { seedProblems } from "../../data/problems";
import { generationSchema, problemSchema, publicProblem, validateReview } from "../problem";
import { DOMAIN_IDS, KINDS, LEVELS, supportsLanguage } from "../catalog";
const stores: Store[] = [];
const dirs: string[] = [];
function store(location = ":memory:") { const s = new Store(location); stores.push(s); return s; }
afterEach(() => { for (const s of stores.splice(0)) s.db.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const p = seedProblems[0];
function reviewed(passed = true) {
  return validateReview({ summary: "요구사항별로 코드를 검토했습니다.", criteria: p.requirements.map((_, requirementIndex) => ({ requirementIndex, passed, feedback: "구체적인 코드의 동작을 확인했습니다." })), strengths: [], improvements: [] }, p);
}
describe("problem bank contracts", () => {
  it("contains realistic tasks covering every domain, kind and difficulty with no exposed answers", () => {
    expect(new Set(seedProblems.map(p => p.domain))).toEqual(new Set(DOMAIN_IDS));
    expect(new Set(seedProblems.map(p => p.kind))).toEqual(new Set(KINDS));
    expect(new Set(seedProblems.map(p => p.difficulty))).toEqual(new Set(LEVELS));
    for (const p of seedProblems) {
      expect(problemSchema.safeParse(p).success, p.id).toBe(true);
      expect(supportsLanguage(p.domain, p.language)).toBe(true);
      expect(p.starterCode.trim()).not.toBe(p.solution.trim());
      expect(publicProblem(p)).not.toHaveProperty("solution");
      expect(publicProblem(p)).not.toHaveProperty("hints");
      expect(publicProblem(p)).not.toHaveProperty("explanation");
    }
  });
  it("rejects unsupported domain/language combinations and malformed generation requests", () => {
    const valid = { domain: "frontend", language: "tsx", difficulty: "중", kind: "debugging", topic: "비동기 검색", requestId: crypto.randomUUID() };
    expect(generationSchema.safeParse(valid).success).toBe(true);
    for (const invalid of [{ ...valid, language: "sql" }, { ...valid, difficulty: "입문" }, { ...valid, topic: " " }, { ...valid, requestId: "x" }]) expect(generationSchema.safeParse(invalid).success).toBe(false);
  });
  it("rejects missing and duplicate AI criteria and derives pass status independently", () => {
    const review = reviewed();
    expect(review.score).toBe(100);
    expect(review.passed).toBe(true);
    expect(() => validateReview({ ...review, criteria: review.criteria.slice(1) }, p)).toThrow();
    expect(() => validateReview({ ...review, criteria: review.criteria.map(c => ({ ...c, requirementIndex: 0 })) }, p)).toThrow();
    expect(validateReview({ ...review, criteria: review.criteria.map((c,i) => ({ ...c, passed: i !== 0 })) }, p).passed).toBe(false);
  });
});
describe("durable isolated learning state", () => {
  it("keeps growing library responses free of full source code and problem bodies", () => {
    const s=store();
    const summary=s.summaries()[0];
    for (const key of ["solution","hints","explanation","scenario","requirements","starterCode","examples"]) expect(summary).not.toHaveProperty(key);
    expect(summary.hintCount).toBe(3);
    expect(summary.title.length).toBeGreaterThan(0);
  });
  it("persists generated problems and personal state after closing and reopening the database", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "recode-db-")); dirs.push(dir);
    const location = path.join(dir,"test.sqlite");
    const first = store(location);
    first.addProblem({ ...p, id: "ai-persistence", source: "ai" });
    first.saveProgress("alice", "ai-persistence", { code: "my saved code", bookmarked: true });
    first.db.close(); stores.splice(stores.indexOf(first),1);
    const second = store(location);
    expect(second.problem("ai-persistence")?.source).toBe("ai");
    expect(second.progress("alice")["ai-persistence"]).toMatchObject({ code: "my saved code", bookmarked: true });
    expect(second.problems()).toHaveLength(seedProblems.length+1);
    expect(second.progress("bob")).toEqual({});
  });
  it("does not overwrite a draft on bookmark, reveal or review and preserves solved status", () => {
    const s = store();
    s.saveProgress("alice", p.id, { code: "new draft" });
    s.saveProgress("alice", p.id, { bookmarked: true });
    s.reveal("alice", p, "hint");
    const a = s.saveAttempt("alice", p.id, "older submitted code", reviewed());
    expect(a.assisted).toBe(true);
    s.saveProgress("alice", p.id, { code: "newer draft" });
    s.saveAttempt("alice", p.id, "another submission", reviewed(false));
    expect(s.progress("alice")[p.id]).toMatchObject({ status: "solved", code: "newer draft", bookmarked: true, hintsViewed: 1 });
    expect(s.attempts("alice")).toHaveLength(2);
    expect(s.attempts("bob")).toHaveLength(0);
  });
  it("caps hints and never marks revealing an answer as solved", () => {
    const s = store();
    for (let i=0;i<10;i++) s.reveal("a",p,"hint");
    s.reveal("a",p,"solution");
    expect(s.progress("a")[p.id]).toMatchObject({ hintsViewed:3, solutionViewed:true, status:"new" });
  });
  it("keeps generation idempotent and rejects cross-owner result access", () => {
    const s = store();
    expect(s.startJob("a","job","generate").state).toBe("new");
    expect(s.startJob("a","job","generate").state).toBe("pending");
    s.finishJob("job",p.id);
    expect(s.startJob("a","job","generate")).toEqual({ state:"done", result:p.id });
    expect(s.startJob("b","job","generate").state).toBe("pending");
    expect(s.startJob("a","job","review").state).toBe("pending");
  });
  it("enforces transactional limits without charging other buckets on denial", () => {
    const s=store();
    const first={key:"a",max:1,windowMs:1000};
    expect(s.consumeLimits([first],100)).toBe(true);
    expect(s.consumeLimits([{key:"b",max:2,windowMs:1000},first],200)).toBe(false);
    expect(s.db.prepare("SELECT count FROM limits WHERE key='b'").get()).toBeUndefined();
    expect(s.consumeLimits([first],1101)).toBe(true);
  });
  it("imports backups into a different browser without replacing existing code or duplicating attempts", () => {
    const s=store();
    s.saveProgress("a",p.id,{code:"original code",bookmarked:true});
    s.saveAttempt("a",p.id,"submitted code",reviewed());
    const backup = { version:2 as const, problems:[p], progress:s.progress("a"), attempts:s.attempts("a") };
    s.saveProgress("b",p.id,{code:"keep this code"});
    const first=s.importBackup("b",backup);
    expect(first.attempts).toBe(1);
    expect(s.progress("b")[p.id].code).toBe("keep this code");
    expect(s.attempts("b")).toHaveLength(1);
    expect(s.importBackup("b",backup).attempts).toBe(0);
    expect(s.attempts("a")).toHaveLength(1);
  });
  it("rolls back the entire import if an attempt refers to a missing problem", () => {
    const s=store();
    const invalid = {version:2 as const,problems:[{...p,id:"new-import"}],progress:{},attempts:[{id:"bad",problemId:"missing",code:"code",review:reviewed(),assisted:false,createdAt:new Date().toISOString()}]};
    expect(() => s.importBackup("a",invalid)).toThrow();
    expect(s.problem("new-import")).toBeNull();
  });
  it("archives legacy data without overwriting the original", () => {
    const s=store();
    s.archiveLegacy("a",{generatedLessons:[{id:"old"}]});
    s.archiveLegacy("a",{generatedLessons:[]});
    expect(s.legacy("a")).toEqual({generatedLessons:[{id:"old"}]});
    expect(s.legacy("b")).toBeNull();
  });
});
