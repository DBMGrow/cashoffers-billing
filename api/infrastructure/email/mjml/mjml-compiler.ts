import mjml2html from "mjml"
import { promises as fs } from "fs"
import { IMjmlCompiler, MjmlCompilationResult } from "./mjml-compiler.interface"
import { ILogger } from "@api/infrastructure/logging/logger.interface"

/**
 * MJML Compiler Implementation
 *
 * Compiles MJML templates to responsive HTML emails
 * with variable substitution support.
 */
export class MjmlCompiler implements IMjmlCompiler {
  constructor(private readonly logger: ILogger) {}

  async compile(mjml: string, variables?: Record<string, string>): Promise<string> {
    try {
      // Replace variables in MJML
      let processedMjml = mjml
      if (variables) {
        processedMjml = this.replaceVariables(mjml, variables)
      }

      // Compile MJML to HTML
      const result = mjml2html(processedMjml, {
        validationLevel: "soft", // Don't fail on warnings
        minify: false, // Keep readable for debugging
      })

      if (result.errors.length > 0) {
        this.logger.warn("MJML compilation warnings", {
          errors: result.errors,
        })
      }

      return result.html
    } catch (error) {
      this.logger.error("MJML compilation failed", { error })
      throw new Error(`Failed to compile MJML: ${error}`)
    }
  }

  async compileFile(templatePath: string, variables?: Record<string, string>): Promise<string> {
    try {
      const mjml = await fs.readFile(templatePath, "utf-8")
      return await this.compile(mjml, variables)
    } catch (error) {
      this.logger.error("Failed to read MJML file", {
        templatePath,
        error,
      })
      throw new Error(`Failed to read MJML file: ${templatePath}`)
    }
  }

  /**
   * Replace {{variable}} placeholders with actual values
   */
  private replaceVariables(mjml: string, variables: Record<string, string>): string {
    let result = mjml

    for (const [key, value] of Object.entries(variables)) {
      // Replace {{key}} with value
      const placeholder = `{{${key}}}`
      result = result.split(placeholder).join(value)
    }

    return result
  }
}

/**
 * Create an MJML compiler instance
 */
export const createMjmlCompiler = (logger: ILogger): IMjmlCompiler => {
  return new MjmlCompiler(logger)
}
