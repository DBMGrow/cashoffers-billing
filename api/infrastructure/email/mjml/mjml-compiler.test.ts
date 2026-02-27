import { describe, it, expect, beforeEach } from "vitest"
import { MjmlCompiler } from "./mjml-compiler"
import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { promises as fs } from "fs"
import path from "path"

// Mock logger
class MockLogger implements ILogger {
  debug = () => {}
  info = () => {}
  warn = () => {}
  error = () => {}
  child = () => this
}

describe("MjmlCompiler", () => {
  let compiler: MjmlCompiler
  let logger: MockLogger

  beforeEach(() => {
    logger = new MockLogger()
    compiler = new MjmlCompiler(logger)
  })

  describe("compile", () => {
    it("should compile basic MJML to HTML", async () => {
      const mjml = `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>Hello World</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `

      const html = await compiler.compile(mjml)

      expect(html).toContain("Hello World")
      expect(html).toContain("<!doctype html>")
    })

    it("should replace variables in MJML", async () => {
      const mjml = `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>Hello {{name}}</mj-text>
                <mj-text>Amount: {{amount}}</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `

      const html = await compiler.compile(mjml, {
        name: "John Doe",
        amount: "$100.00",
      })

      expect(html).toContain("Hello John Doe")
      expect(html).toContain("Amount: $100.00")
      expect(html).not.toContain("{{name}}")
      expect(html).not.toContain("{{amount}}")
    })

    it("should handle multiple occurrences of same variable", async () => {
      const mjml = `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>{{name}}</mj-text>
                <mj-text>Welcome {{name}}</mj-text>
                <mj-text>Thanks {{name}}</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `

      const html = await compiler.compile(mjml, {
        name: "Alice",
      })

      // Count occurrences of "Alice"
      const matches = html.match(/Alice/g)
      expect(matches).toHaveLength(3)
    })

    it("should handle MJML with styling attributes", async () => {
      const mjml = `
        <mjml>
          <mj-body background-color="#f3f4f6">
            <mj-section background-color="#1e40af" padding="30px">
              <mj-column>
                <mj-text color="#ffffff" font-size="24px">
                  Styled Text
                </mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `

      const html = await compiler.compile(mjml)

      expect(html).toContain("Styled Text")
      // Should contain style attributes (MJML converts to inline styles)
      expect(html).toContain("color")
      expect(html).toContain("font-size")
    })

    it("should handle MJML without variables", async () => {
      const mjml = `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>No variables here</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `

      const html = await compiler.compile(mjml)

      expect(html).toContain("No variables here")
    })

    it("should throw error for invalid MJML", async () => {
      const invalidMjml = "<mjml><invalid-tag></mjml>"

      await expect(compiler.compile(invalidMjml)).rejects.toThrow(
        "Failed to compile MJML"
      )
    })

    it("should handle empty variables gracefully", async () => {
      const mjml = `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>{{name}}</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `

      const html = await compiler.compile(mjml, {})

      // Variable should remain unreplaced
      expect(html).toContain("{{name}}")
    })
  })

  describe("compileFile", () => {
    const templatesDir = path.join(process.cwd(), "api", "templates", "mjml")

    it("should compile fragment template wrapped in default layout", async () => {
      const templatePath = path.join(templatesDir, "payment-confirmation.mjml")

      const html = await compiler.compileFile(templatePath, {
        amount: "$250.00",
        transactionID: "TXN-12345",
        date: "2024-01-15",
      })

      expect(html).toContain("$250.00")
      expect(html).toContain("TXN-12345")
      expect(html).toContain("2024-01-15")
      expect(html).toContain("<!doctype html>")
      // Layout footer should be injected automatically
      expect(html).toContain("support@cashoffers.com")
      expect(html).toContain("CashOffers")
    })

    it("should apply default emailTitle and currentYear from layout", async () => {
      const templatePath = path.join(templatesDir, "refund.mjml")

      const html = await compiler.compileFile(templatePath, {
        amount: "$50.00",
        date: "2024-01-15",
      })

      expect(html).toContain("<!doctype html>")
      expect(html).toContain(String(new Date().getFullYear()))
    })

    it("should allow overriding emailTitle via variables", async () => {
      const templatePath = path.join(templatesDir, "refund.mjml")

      const html = await compiler.compileFile(templatePath, {
        amount: "$50.00",
        date: "2024-01-15",
        emailTitle: "Your Refund Confirmation",
      })

      expect(html).toContain("Your Refund Confirmation")
    })

    it("should compile standalone template as-is (layout opt-out)", async () => {
      const templatePath = path.join(templatesDir, "daily-health-report.mjml")

      const html = await compiler.compileFile(templatePath, {
        emailTitle: "Health Report",
        reportDate: "2024-01-15",
        totalRenewalsToday: "5",
        successfulRenewals: "4",
        failedRenewals: "1",
        totalRevenueToday: "$500.00",
        pendingRetries: "1",
        activeSubscriptions: "100",
        pausedSubscriptions: "2",
        cancelledSubscriptions: "1",
        newSubscriptionsToday: "3",
        successRate: "80%",
        systemStatus: "healthy",
        databaseStatus: "ok",
        squareApiStatus: "ok",
        sendgridStatus: "ok",
        recentErrors: "none",
        upcomingRenewals24h: "10",
      })

      expect(html).toContain("<!doctype html>")
      expect(html).toContain("Health Report")
    })

    it("should compile payment error template as fragment", async () => {
      const templatePath = path.join(templatesDir, "payment-error.mjml")

      const html = await compiler.compileFile(templatePath, {
        amount: "$250.00",
        errorMessage: "Your card was declined by your bank",
        suggestions: "Try a different payment method",
        updatePaymentUrl: "https://example.com/update",
        date: "2024-01-15",
      })

      expect(html).toContain("Payment Failed")
      expect(html).toContain("Your card was declined by your bank")
      expect(html).toContain("Try a different payment method")
      expect(html).toContain("<!doctype html>")
    })

    it("should throw error for non-existent file", async () => {
      const fakePath = path.join(templatesDir, "non-existent.mjml")

      await expect(
        compiler.compileFile(fakePath, {})
      ).rejects.toThrow("Failed to read MJML file")
    })
  })

  describe("variable replacement", () => {
    it("should handle special characters in variable values", async () => {
      const mjml = `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>{{message}}</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `

      const html = await compiler.compile(mjml, {
        message: "Amount: $1,234.56 & more!",
      })

      // MJML outputs special characters in text content
      expect(html).toContain("Amount: $1,234.56")
      expect(html).toContain("more!")
    })

    it("should not replace malformed variable placeholders", async () => {
      const mjml = `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>{{name}} {missing} {{incomplete</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `

      const html = await compiler.compile(mjml, {
        name: "John",
      })

      expect(html).toContain("John")
      expect(html).toContain("{missing}")
      expect(html).toContain("{{incomplete")
    })

    it("should handle numeric variable values", async () => {
      const mjml = `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>Count: {{count}}</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `

      const html = await compiler.compile(mjml, {
        count: "42",
      })

      expect(html).toContain("Count: 42")
    })
  })

  describe("complex templates", () => {
    it("should compile template with multiple sections", async () => {
      const mjml = `
        <mjml>
          <mj-body>
            <mj-section background-color="#1e40af">
              <mj-column>
                <mj-text>Header: {{title}}</mj-text>
              </mj-column>
            </mj-section>
            <mj-section>
              <mj-column>
                <mj-text>Body: {{content}}</mj-text>
              </mj-column>
            </mj-section>
            <mj-section background-color="#f9fafb">
              <mj-column>
                <mj-text>Footer: {{footer}}</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `

      const html = await compiler.compile(mjml, {
        title: "Welcome",
        content: "Main content here",
        footer: "Copyright 2024",
      })

      expect(html).toContain("Header: Welcome")
      expect(html).toContain("Body: Main content here")
      expect(html).toContain("Footer: Copyright 2024")
    })

    it("should compile template with tables", async () => {
      const mjml = `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-table>
                  <tr>
                    <td>Amount</td>
                    <td>{{amount}}</td>
                  </tr>
                  <tr>
                    <td>Date</td>
                    <td>{{date}}</td>
                  </tr>
                </mj-table>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `

      const html = await compiler.compile(mjml, {
        amount: "$100.00",
        date: "2024-01-15",
      })

      expect(html).toContain("Amount")
      expect(html).toContain("$100.00")
      expect(html).toContain("Date")
      expect(html).toContain("2024-01-15")
    })
  })
})
