import fs from 'fs/promises'
import path from 'path'

/**
 * Parse email template and replace fields
 * Simple implementation - can be enhanced with a proper template engine
 */
export async function parseEmailTemplate(
  templateName: string,
  fields: Record<string, unknown>
): Promise<string> {
  // Read template file
  const templatePath = path.join(process.cwd(), 'src', 'templates', templateName)

  try {
    let template = await fs.readFile(templatePath, 'utf-8')

    // Replace all fields in template
    Object.entries(fields).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g')
      template = template.replace(placeholder, String(value))
    })

    return template
  } catch (error) {
    // If template not found, return a simple HTML with the fields
    console.error(`Template ${templateName} not found, using fallback`)

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
