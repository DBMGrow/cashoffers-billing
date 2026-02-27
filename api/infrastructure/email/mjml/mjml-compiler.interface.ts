/**
 * MJML Compiler Interface
 *
 * Compiles MJML templates to responsive HTML emails
 */
export interface IMjmlCompiler {
  /**
   * Compile MJML to HTML
   *
   * @param mjml MJML template string
   * @param variables Optional variables to inject into template
   * @returns Compiled HTML email
   *
   * @example
   * ```typescript
   * const html = await compiler.compile(mjmlTemplate, {
   *   userName: "John",
   *   amount: "$50.00"
   * })
   * ```
   */
  compile(mjml: string, variables?: Record<string, string>): Promise<string>

  /**
   * Compile MJML file to HTML
   *
   * Templates that begin with <mjml> are compiled as standalone documents.
   * All other templates are treated as content fragments and automatically
   * wrapped in _layout.mjml (from the same directory).
   *
   * @param templatePath Path to MJML template file
   * @param variables Optional variables to inject into template
   * @param layoutPath Optional path to override the default layout
   * @returns Compiled HTML email
   */
  compileFile(
    templatePath: string,
    variables?: Record<string, string>,
    layoutPath?: string
  ): Promise<string>
}

/**
 * MJML compilation result
 */
export interface MjmlCompilationResult {
  html: string
  errors: string[]
}
