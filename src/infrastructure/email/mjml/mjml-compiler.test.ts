import { describe, it, expect, beforeEach } from "vitest"
import { MjmlCompiler } from "./mjml-compiler"
import { ILogger } from "@/infrastructure/logging/logger.interface"
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
    it("should compile existing MJML file", async () => {
      const templatePath = path.join(
        process.cwd(),
        "src",
        "templates",
        "mjml",
        "payment-confirmation.mjml"
      )

      const html = await compiler.compileFile(templatePath, {
        amount: "$250.00",
        transactionID: "TXN-12345",
        date: "2024-01-15",
      })

      expect(html).toContain("$250.00")
      expect(html).toContain("TXN-12345")
      expect(html).toContain("2024-01-15")
      expect(html).toContain("<!doctype html>")
    })

    it("should throw error for non-existent file", async () => {
      const fakePath = path.join(
        process.cwd(),
        "src",
        "templates",
        "mjml",
        "non-existent.mjml"
      )

      await expect(
        compiler.compileFile(fakePath, {})
      ).rejects.toThrow("Failed to read MJML file")
    })

    it("should compile payment error template", async () => {
      const templatePath = path.join(
        process.cwd(),
        "src",
        "templates",
        "mjml",
        "payment-error.mjml"
      )

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
