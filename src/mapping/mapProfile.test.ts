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
