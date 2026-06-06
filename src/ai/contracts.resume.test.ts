import { describe, it, expect } from "vitest";
import { resumeResponseSchema } from "./contracts";

const valid = {
  name: "Dev Tejot",
  headline: "Full-Stack Engineer · React · Next.js",
  contact: { email: "dev@example.com", phone: "+91 97129 86516", location: "Gandhinagar", links: ["linkedin.com/in/dev-tejot"] },
  summary: "Frontend-focused engineer, 3+ yrs.",
  experience: [
    { company: "Genuin", location: "Ahmedabad", title: "Software Engineer II", dates: "May 2025 – Present", stack: "Next.js 15", bullets: ["Built a 60+ component design system."] },
  ],
  skills: [{ label: "Frontend", items: "React, Next.js, TypeScript" }],
  projects: [{ name: "ApplyPilot", stack: "React 18, MV3", link: "github.com/devtejot", bullets: ["Autofills job applications."] }],
  education: [{ school: "DA-IICT", location: "Gandhinagar", degree: "B.Tech ICT", dates: "2019 – 2023", coursework: "DSA, Distributed Systems" }],
};

describe("resumeResponseSchema", () => {
  it("accepts a complete resume", () => {
    expect(resumeResponseSchema.safeParse(valid).success).toBe(true);
  });
  it("accepts minimal optional fields omitted", () => {
    const min = { ...valid, contact: {}, projects: undefined, experience: [{ company: "X", title: "Eng", dates: "2020", bullets: [] }] };
    expect(resumeResponseSchema.safeParse(min).success).toBe(true);
  });
  it("rejects when required summary is missing", () => {
    const bad = { ...valid } as Record<string, unknown>;
    delete bad.summary;
    expect(resumeResponseSchema.safeParse(bad).success).toBe(false);
  });
});
