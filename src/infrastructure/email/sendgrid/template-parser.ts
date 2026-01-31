import fs from 'fs/promises'
import path from 'path'
import type { IMjmlCompiler } from '@/infrastructure/email/mjml/mjml-compiler.interface'

/**
 * Parse email template and replace fields
 * Supports both MJML and HTML templates with automatic fallback
 */
export async function parseEmailTemplate(
  templateName: string,
  fields: Record<string, unknown>,
  mjmlCompiler?: IMjmlCompiler
): Promise<string> {
  const templatesDir = path.join(process.cwd(), 'src', 'templates')

  try {
    // First, try to find and compile MJML template
    if (mjmlCompiler) {
      const mjmlPath = await findMjmlTemplate(templatesDir, templateName)
      if (mjmlPath) {
        // Convert fields to string record for MJML compiler
        const stringFields: Record<string, string> = {}
        Object.entries(fields).forEach(([key, value]) => {
          stringFields[key] = String(value)
        })

        const html = await mjmlCompiler.compileFile(mjmlPath, stringFields)
        return html
      }
    }

    // Fall back to HTML template
    const htmlPath = path.join(templatesDir, templateName)
    let template = await fs.readFile(htmlPath, 'utf-8')

    // Replace all fields in template
    Object.entries(fields).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g')
      template = template.replace(placeholder, String(value))
    })

    return template
  } catch (error) {
    // If template not found, return a simple HTML with the fields
    console.error(`Template ${templateName} not found, using fallback`, error)

    const fallbackHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${fields.subject || 'Email'}</title>
        </head>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${Object.entries(fields)
              .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
              .join('')}
          </div>
        </body>
      </html>
    `

    return fallbackHtml
  }
}

/**
 * Find MJML template file
 * Checks both with and without .mjml extension
 */
async function findMjmlTemplate(
  templatesDir: string,
  templateName: string
): Promise<string | null> {
  // If template name already ends with .mjml, use it directly
  if (templateName.endsWith('.mjml')) {
    const mjmlPath = path.join(templatesDir, 'mjml', templateName)
    try {
      await fs.access(mjmlPath)
      return mjmlPath
    } catch {
      return null
    }
  }

  // Try to find MJML version by replacing .html with .mjml
  const mjmlName = templateName.replace(/\.html$/, '.mjml')
  const mjmlPath = path.join(templatesDir, 'mjml', mjmlName)

  try {
    await fs.access(mjmlPath)
    return mjmlPath
  } catch {
    return null
  }
}
