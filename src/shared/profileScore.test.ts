import { describe, it, expect } from "vitest";
import type { CandidateProfile } from "./types";
import { profileScore } from "./profileScore";

const empty: CandidateProfile = {
  version: 1,
  personal: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: { city: "", state: "", country: "" },
    links: {},
  },
  eligibility: { workAuthorized: false, requiresSponsorship: false, willingToRelocate: false },
  resume: { fileName: "", text: "", updatedAt: 0 },
  workHistory: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
};

describe("profileScore", () => {
  it("is 0 for an empty profile and lists gaps", () => {
    const s = profileScore(empty);
    expect(s.percent).toBe(0);
    expect(s.missing).toContain("Name");
    expect(s.missing).toContain("Resume");
  });

  it("is 100 for a fully populated profile with no gaps", () => {
    const full: CandidateProfile = {
      ...empty,
      personal: {
        ...empty.personal,
        firstName: "Dev",
        lastName: "Tejot",
        email: "dev@example.com",
        phone: "+14155551234",
        location: { city: "Austin", state: "TX", country: "USA" },
        links: { linkedin: "linkedin.com/in/dev" },
      },
      resume: { fileName: "cv.pdf", text: "experience...", updatedAt: 0 },
      workHistory: [{ company: "Globex", title: "Eng", startDate: "2021", endDate: "now", bullets: [] }],
      education: [{ school: "MIT", degree: "BS", field: "CS" }],
      skills: ["React"],
      summary: "Engineer.",
    };
    const s = profileScore(full);
    expect(s.percent).toBe(100);
    expect(s.missing).toEqual([]);
  });

  it("rises as more fields are filled", () => {
    const partial: CandidateProfile = {
      ...empty,
      personal: { ...empty.personal, firstName: "Dev", lastName: "Tejot", email: "dev@example.com" },
    };
    const s = profileScore(partial);
    expect(s.percent).toBeGreaterThan(0);
    expect(s.percent).toBeLessThan(100);
  });
});
