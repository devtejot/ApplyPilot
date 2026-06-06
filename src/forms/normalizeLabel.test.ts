import { describe, it, expect } from "vitest";
import { normalizeLabel, tokenizeLabel } from "./normalizeLabel";

describe("normalizeLabel", () => {
  it("strips required/optional markers and asterisks", () => {
    expect(normalizeLabel("First Name *")).toBe("first name");
    expect(normalizeLabel("Email (required)")).toBe("email");
    expect(normalizeLabel("Portfolio (optional)")).toBe("portfolio");
    expect(normalizeLabel("Phone — required")).toBe("phone —");
  });

  it("drops trailing colons and collapses whitespace", () => {
    expect(normalizeLabel("LinkedIn URL:")).toBe("linkedin url");
    expect(normalizeLabel("  Cover   Letter  ")).toBe("cover letter");
  });

  it("preserves question marks (used to detect freeform)", () => {
    expect(normalizeLabel("Why do you want to work here?")).toBe("why do you want to work here?");
  });
});

describe("tokenizeLabel", () => {
  it("removes glue words and punctuation so word order doesn't matter", () => {
    expect(tokenizeLabel("Url for LinkedIn")).toEqual(["url", "linkedin"]);
    expect(tokenizeLabel("Phone Number (required)")).toEqual(["phone", "number"]);
    expect(tokenizeLabel("Your City / Town")).toEqual(["city", "town"]);
  });
});
