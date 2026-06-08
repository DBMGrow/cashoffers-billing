import { describe, it, expect } from "vitest"
import { resolveHealthReportRecipients } from "./health-report-recipients"

describe("resolveHealthReportRecipients", () => {
  it("returns just devEmail when nothing else is configured", () => {
    expect(resolveHealthReportRecipients({ devEmail: "dev@x.com" })).toEqual(["dev@x.com"])
  })

  it("includes adminEmail when configured", () => {
    expect(
      resolveHealthReportRecipients({ devEmail: "dev@x.com", adminEmail: "admin@x.com" })
    ).toEqual(["dev@x.com", "admin@x.com"])
  })

  it("appends additional health report recipients in order", () => {
    expect(
      resolveHealthReportRecipients({
        devEmail: "dev@x.com",
        adminEmail: "admin@x.com",
        healthReportRecipients: ["a@x.com", "b@x.com", "c@x.com"],
      })
    ).toEqual(["dev@x.com", "admin@x.com", "a@x.com", "b@x.com", "c@x.com"])
  })

  it("deduplicates case-insensitively, preserving first-seen casing and order", () => {
    expect(
      resolveHealthReportRecipients({
        devEmail: "Dev@x.com",
        adminEmail: "dev@x.com",
        healthReportRecipients: ["a@x.com", "A@x.com", "b@x.com"],
      })
    ).toEqual(["Dev@x.com", "a@x.com", "b@x.com"])
  })

  it("ignores blank and whitespace-only entries", () => {
    expect(
      resolveHealthReportRecipients({
        devEmail: "dev@x.com",
        healthReportRecipients: ["", "   ", "real@x.com"],
      })
    ).toEqual(["dev@x.com", "real@x.com"])
  })

  it("trims surrounding whitespace on recipients", () => {
    expect(
      resolveHealthReportRecipients({
        devEmail: "dev@x.com",
        healthReportRecipients: [" spaced@x.com "],
      })
    ).toEqual(["dev@x.com", "spaced@x.com"])
  })

  it("returns an empty array when devEmail is blank and nothing else is set", () => {
    expect(resolveHealthReportRecipients({ devEmail: "" })).toEqual([])
  })
})
