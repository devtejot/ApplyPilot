import { describe, it, expect } from "vitest";
import type { CandidateProfile, FieldDescriptor } from "@/shared/types";
import { mapField, mapDeterministic } from "./mapProfile";

const profile: CandidateProfile = {
  version: 1,
  personal: {
    firstName: "Dev",
    lastName: "Tejot",
    email: "dev@example.com",
    phone: "+1 (415) 555-1234",
    location: { city: "Austin", state: "TX", country: "USA" },
    links: { linkedin: "linkedin.com/in/dev", github: "github.com/dev" },
  },
  eligibility: {
    workAuthorized: true,
    requiresSponsorship: false,
    willingToRelocate: true,
  },
  resume: { fileName: "cv.pdf", text: "...", updatedAt: 0 },
  workHistory: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
};

function field(
  partial: Partial<FieldDescriptor> & { label: string },
): FieldDescriptor {
  return {
    id: "f1",
    selector: "#f1",
    controlType: "text",
    labelSource: "label-for",
    required: false,
    ...partial,
  };
}

describe("mapField — deterministic tier-1", () => {
  it("maps an email field", () => {
    const fill = mapField(
      field({ label: "Email", controlType: "email" }),
      profile,
    );
    expect(fill).toMatchObject({
      value: "dev@example.com",
      source: "deterministic",
      needsReview: false,
    });
    expect(fill!.confidence).toBeCloseTo(1);
  });

  it("maps first and last name", () => {
    expect(mapField(field({ label: "First name" }), profile)!.value).toBe(
      "Dev",
    );
    expect(mapField(field({ label: "Last Name" }), profile)!.value).toBe(
      "Tejot",
    );
  });

  it("maps and normalizes phone", () => {
    expect(
      mapField(field({ label: "Phone", controlType: "tel" }), profile)!.value,
    ).toBe("+14155551234");
  });

  it("maps and normalizes LinkedIn and GitHub URLs", () => {
    expect(mapField(field({ label: "LinkedIn Profile" }), profile)!.value).toBe(
      "https://linkedin.com/in/dev",
    );
    expect(mapField(field({ label: "GitHub" }), profile)!.value).toBe(
      "https://github.com/dev",
    );
  });

  it("maps a full-name field without colliding with first/last", () => {
    expect(mapField(field({ label: "Full Name" }), profile)!.value).toBe(
      "Dev Tejot",
    );
  });

  it("flags low-confidence matches from weak label sources", () => {
    const fill = mapField(
      field({
        label: "Email",
        controlType: "email",
        labelSource: "placeholder",
      }),
      profile,
    );
    expect(fill!.needsReview).toBe(true);
    expect(fill!.confidence).toBeLessThan(0.85);
  });

  it("returns null for an unmapped freeform question", () => {
    expect(
      mapField(
        field({
          label: "Why do you want to work here?",
          controlType: "textarea",
        }),
        profile,
      ),
    ).toBeNull();
  });

  it("returns null for a resume file input (not tier-1 text)", () => {
    expect(
      mapField(field({ label: "Resume", controlType: "file" }), profile),
    ).toBeNull();
  });

  it("does not map a long freeform question even if it contains a keyword", () => {
    const f = field({
      label:
        "If you were previously employed by Remotecom, what email address did you use when you applied?",
      controlType: "text",
    });
    expect(mapField(f, profile)).toBeNull();
  });

  it("does not map a label phrased as a question", () => {
    expect(mapField(field({ label: "What is your full name?" }), profile)).toBeNull();
  });

  it("still maps a short, field-like label", () => {
    expect(mapField(field({ label: "Email" }), profile)!.value).toBe("dev@example.com");
  });

  it("returns null when the profile value is missing", () => {
    const fill = mapField(
      field({ label: "Portfolio website", controlType: "url" }),
      profile,
    );
    expect(fill).toBeNull(); // profile has no portfolio
  });
});

describe("mapField — eligibility dropdowns", () => {
  const yesNo = [
    { value: "", label: "Select…" },
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ];

  it("selects Yes for work authorization", () => {
    const fill = mapField(
      field({ label: "Are you authorized to work in the US?", controlType: "select", options: yesNo }),
      profile,
    );
    expect(fill).toMatchObject({ value: "yes", source: "deterministic", needsReview: true });
  });

  it("selects No for sponsorship (profile requires none)", () => {
    const fill = mapField(
      field({ label: "Do you require visa sponsorship?", controlType: "select", options: yesNo }),
      profile,
    );
    expect(fill?.value).toBe("no");
  });

  it("handles a radio group (willing to relocate = yes)", () => {
    const fill = mapField(
      field({ label: "Are you willing to relocate?", controlType: "radio", group: "rel", options: yesNo }),
      profile,
    );
    expect(fill?.value).toBe("yes");
  });

  it("maps eligibility to a combobox (yes/no value, options resolved at fill time)", () => {
    const fill = mapField(
      field({ label: "Do you require visa sponsorship?", controlType: "combobox" }),
      profile,
    );
    expect(fill?.value).toBe("no");
  });

  it("returns null for a non-eligibility dropdown", () => {
    expect(
      mapField(field({ label: "How did you hear about us?", controlType: "select", options: yesNo }), profile),
    ).toBeNull();
  });
});

const rich: CandidateProfile = {
  ...profile,
  personal: {
    ...profile.personal,
    middleName: "Kumar",
    preferredName: "DJ",
    pronouns: "he/him",
    dateOfBirth: "1995-04-12",
    languages: ["English", "Hindi"],
    location: { line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", country: "India", postalCode: "560001" },
    links: { ...profile.personal.links, twitter: "x.com/dj" },
  },
  eligibility: {
    ...profile.eligibility,
    currentSalary: "18 LPA",
    expectedSalary: "26 LPA",
    noticePeriod: "30 days",
    availableStartDate: "2026-07-01",
    yearsExperience: "7",
    citizenship: "Indian",
  },
  demographics: { gender: "Female", veteranStatus: "I am not a veteran" },
  howHeard: "Referral",
  workHistory: [{ company: "Globex", title: "Staff Engineer", startDate: "2021-03", endDate: "present", bullets: [] }],
  education: [{ school: "IIT Bombay", degree: "B.Tech", field: "Computer Science", endDate: "2017" }],
};

describe("mapField — expanded coverage", () => {
  const v = (label: string, p = rich, controlType: FieldDescriptor["controlType"] = "text") =>
    mapField(field({ label, controlType }), p)?.value;

  it("maps address parts and guards address line 2", () => {
    expect(v("Address Line 1")).toBe("12 MG Road");
    expect(v("Address line 2")).toBeUndefined(); // guarded → null
    expect(v("City")).toBe("Bengaluru");
    expect(v("State / Province")).toBe("Karnataka");
    expect(v("Country")).toBe("India");
    expect(v("PIN code")).toBe("560001");
  });

  it("maps current employer and title from the latest role", () => {
    expect(v("Current Employer")).toBe("Globex");
    expect(v("Current Title")).toBe("Staff Engineer");
  });

  it("maps current and expected compensation (CTC synonyms)", () => {
    expect(v("Current CTC")).toBe("18 LPA");
    expect(v("Expected CTC")).toBe("26 LPA");
    expect(v("Desired Salary")).toBe("26 LPA");
  });

  it("maps availability and experience", () => {
    expect(v("Notice Period")).toBe("30 days");
    expect(v("Years of experience")).toBe("7");
    expect(v("Available start date")).toBe("2026-07-01");
  });

  it("maps identity fields", () => {
    expect(v("Preferred name")).toBe("DJ");
    expect(v("Middle name")).toBe("Kumar");
    expect(v("Pronouns")).toBe("he/him");
    expect(v("Citizenship")).toBe("Indian");
    expect(v("Date of birth")).toBe("1995-04-12");
  });

  it("maps education and misc fields", () => {
    expect(v("University")).toBe("IIT Bombay");
    expect(v("Degree")).toBe("B.Tech");
    expect(v("Languages")).toBe("English, Hindi");
    expect(v("Twitter")).toBe("https://x.com/dj");
  });

  it("prepends the India dial code when filling phone for an India profile", () => {
    const india = { ...rich, personal: { ...rich.personal, phone: "98765 43210" } };
    expect(mapField(field({ label: "Mobile", controlType: "tel" }), india)!.value).toBe("+919876543210");
  });
});

describe("mapField — demographics (decline default)", () => {
  const gender = [
    { value: "", label: "Select…" },
    { value: "m", label: "Male" },
    { value: "f", label: "Female" },
    { value: "nb", label: "Non-binary" },
    { value: "decline", label: "I prefer not to say" },
  ];
  const race = [
    { value: "asian", label: "Asian" },
    { value: "white", label: "White" },
    { value: "decline", label: "Decline to self-identify" },
  ];

  it("uses the user's value when set", () => {
    const fill = mapField(field({ label: "Gender", controlType: "select", options: gender }), rich);
    expect(fill).toMatchObject({ value: "f", needsReview: true });
  });

  it("auto-selects the decline option when the user left it blank", () => {
    const fill = mapField(field({ label: "Race / Ethnicity", controlType: "select", options: race }), rich);
    expect(fill?.value).toBe("decline");
  });

  it("emits a decline string for a demographic combobox", () => {
    const fill = mapField(field({ label: "Disability status", controlType: "combobox" }), rich);
    expect(fill?.value).toBe("Decline to self-identify");
  });
});

describe("mapField — normalized + fuzzy fallback", () => {
  const v = (label: string, p = rich, controlType: FieldDescriptor["controlType"] = "text") =>
    mapField(field({ label, controlType }), p);

  it("ignores required-markers and trailing punctuation in labels", () => {
    expect(v("First Name *")!.value).toBe("Dev");
    expect(v("Email (required):", rich, "email")!.value).toBe("dev@example.com");
    expect(v("LinkedIn URL *")!.value).toBe("https://linkedin.com/in/dev");
  });

  it("matches reworded LinkedIn labels", () => {
    expect(v("Url for LinkedIn")!.value).toBe("https://linkedin.com/in/dev");
    expect(v("Your LinkedIn profile")!.value).toBe("https://linkedin.com/in/dev");
    expect(v("Profile on LinkedIn")!.value).toBe("https://linkedin.com/in/dev");
  });

  it("fuzzily matches word-order variants that no exact rule covers", () => {
    const title = v("Title (current)");
    expect(title?.value).toBe("Staff Engineer");
    expect(title?.needsReview).toBe(true); // fuzzy fills always reviewed
    expect(title!.confidence).toBeLessThan(0.85);

    expect(v("Salary expected")?.value).toBe("26 LPA");
  });

  it("does not fuzzy-fire on unrelated labels that merely share a generic word", () => {
    expect(v("Project name")).toBeNull();
    expect(v("Company name")).toBeNull();
  });
});

describe("mapDeterministic — batch", () => {
  it("returns one fill per matched field and skips the rest", () => {
    const fields = [
      field({ id: "a", label: "Email", controlType: "email" }),
      field({ id: "b", label: "Cover letter", controlType: "textarea" }),
      field({ id: "c", label: "First name" }),
    ];
    const fills = mapDeterministic(fields, profile);
    expect(fills.map((f) => f.fieldId).sort()).toEqual(["a", "c"]);
  });
});
