import { describe, it, expect } from "vitest";
import { parseMsg } from "./messages";

const jd = { title: "FE", company: "Acme", text: "jd", url: "u", extractedBy: "adapter" };

describe("TAILOR_RESUME / RESUME_RESULT", () => {
  it("parses a TAILOR_RESUME request", () => {
    expect(parseMsg({ kind: "TAILOR_RESUME", jd })?.kind).toBe("TAILOR_RESUME");
  });
  it("parses a RESUME_RESULT with a structured resume", () => {
    const resume = { name: "Dev", headline: "Eng", contact: {}, summary: "s", experience: [], skills: [], education: [] };
    expect(parseMsg({ kind: "RESUME_RESULT", resume })?.kind).toBe("RESUME_RESULT");
  });
  it("rejects RESUME_RESULT with a malformed resume", () => {
    expect(parseMsg({ kind: "RESUME_RESULT", resume: { name: 1 } })).toBeNull();
  });
});
