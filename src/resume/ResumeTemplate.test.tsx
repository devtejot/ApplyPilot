import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumeTemplate } from "./ResumeTemplate";
import type { ResumeResponse } from "@/ai/contracts";

const data: ResumeResponse = {
  name: "Dev Tejot",
  headline: "Full-Stack Engineer",
  contact: { email: "dev@example.com", links: ["linkedin.com/in/dev-tejot"] },
  summary: "Frontend-focused engineer.",
  experience: [{ company: "Genuin", title: "SE II", dates: "2025–now", bullets: ["Built a design system."] }],
  skills: [{ label: "Frontend", items: "React, Next.js" }],
  projects: [{ name: "ApplyPilot", bullets: ["Autofills applications."], link: "github.com/devtejot" }],
  education: [{ school: "DA-IICT", degree: "B.Tech ICT", dates: "2019–2023" }],
};

describe("ResumeTemplate", () => {
  it("renders name, sections, and content", () => {
    render(<ResumeTemplate data={data} />);
    expect(screen.getByText("Dev Tejot")).toBeInTheDocument();
    expect(screen.getByText("SUMMARY")).toBeInTheDocument();
    expect(screen.getByText("EXPERIENCE")).toBeInTheDocument();
    expect(screen.getByText("Genuin")).toBeInTheDocument();
    expect(screen.getByText("Built a design system.")).toBeInTheDocument();
    expect(screen.getByText("PROJECTS")).toBeInTheDocument();
    expect(screen.getByText("EDUCATION")).toBeInTheDocument();
  });

  it("omits the Projects section when there are no projects", () => {
    render(<ResumeTemplate data={{ ...data, projects: [] }} />);
    expect(screen.queryByText("PROJECTS")).toBeNull();
  });
});
