#!/usr/bin/env tsx
/**
 * Email Preview Generator
 *
 * Generates static HTML previews of all MJML email templates
 * with sample data for visual testing and design review.
 *
 * Usage: npm run preview:generate
 */

import { promises as fs } from "fs"
import path from "path"
import { MjmlCompiler } from "@api/infrastructure/email/mjml/mjml-compiler"
import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { emailPreviews } from "./email-preview-data"

// Simple console logger for script
class ConsoleLogger implements ILogger {
  debug(message: string, meta?: any) {
    console.log(`[DEBUG] ${message}`, meta || "")
  }
  info(message: string, meta?: any) {
    console.log(`[INFO] ${message}`, meta || "")
  }
  warn(message: string, meta?: any) {
    console.warn(`[WARN] ${message}`, meta || "")
  }
  error(message: string, error?: any, meta?: any) {
    console.error(`[ERROR] ${message}`, error, meta || "")
  }
  child() {
    return this
  }
}

async function generatePreviews() {
  const logger = new ConsoleLogger()
  const compiler = new MjmlCompiler(logger)

  const templatesDir = path.join(process.cwd(), "api", "templates", "mjml")
  const previewsDir = path.join(process.cwd(), "email-previews")

  // Create previews directory
  await fs.mkdir(previewsDir, { recursive: true })

  logger.info(`Generating email previews...`)
  logger.info(`Templates: ${templatesDir}`)
  logger.info(`Output: ${previewsDir}`)

  const generatedPreviews: Array<{
    name: string
    fileName: string
    description: string
    subject: string
  }> = []

  // Generate each template preview
  for (const preview of emailPreviews) {
    try {
      logger.info(`Compiling: ${preview.template}`)

      const templatePath = path.join(templatesDir, preview.template)
      const html = await compiler.compileFile(templatePath, preview.variables)

      // Create a nice filename
      const fileName = preview.template.replace(".mjml", ".html")
      const outputPath = path.join(previewsDir, fileName)

      // Wrap in a nice preview frame
      const wrappedHtml = createPreviewWrapper(preview.name, preview.subject, preview.description, html)

      await fs.writeFile(outputPath, wrappedHtml, "utf-8")

      generatedPreviews.push({
        name: preview.name,
        fileName,
        description: preview.description,
        subject: preview.subject,
      })

      logger.info(`✓ Generated: ${fileName}`)
    } catch (error) {
      logger.error(`✗ Failed to generate ${preview.template}:`, error)
    }
  }

  // Generate index page
  const indexHtml = createIndexPage(generatedPreviews)
  await fs.writeFile(path.join(previewsDir, "index.html"), indexHtml, "utf-8")

  logger.info(`\n✓ Generated ${generatedPreviews.length} email previews`)
  logger.info(`✓ Open: email-previews/index.html`)
  logger.info(`\nYou can open the index in your browser to view all templates.`)
}

function createPreviewWrapper(name: string, subject: string, description: string, emailHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} - Email Preview</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .preview-header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .preview-header h1 {
      font-size: 24px;
      color: #1e40af;
      margin-bottom: 8px;
    }
    .preview-header .subject {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .preview-header .description {
      font-size: 14px;
      color: #6b7280;
    }
    .preview-controls {
      background: white;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .preview-controls button {
      padding: 8px 16px;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    .preview-controls button:hover {
      background: #f9fafb;
      border-color: #1e40af;
    }
    .preview-controls .active {
      background: #1e40af;
      color: white;
      border-color: #1e40af;
    }
    .email-container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .back-link {
      display: inline-block;
      margin-bottom: 20px;
      color: #1e40af;
      text-decoration: none;
      font-size: 14px;
    }
    .back-link:hover {
      text-decoration: underline;
    }

    /* Responsive views */
    #desktop-view {
      display: block;
    }
    #mobile-view {
      display: none;
      max-width: 375px;
      margin: 0 auto;
    }
    #mobile-view.active {
      display: block;
    }
    #desktop-view.active {
      display: block;
    }
  </style>
  <script>
    function switchView(view) {
      const desktop = document.getElementById('desktop-view');
      const mobile = document.getElementById('mobile-view');
      const desktopBtn = document.getElementById('desktop-btn');
      const mobileBtn = document.getElementById('mobile-btn');

      if (view === 'mobile') {
        desktop.style.display = 'none';
        mobile.style.display = 'block';
        desktopBtn.classList.remove('active');
        mobileBtn.classList.add('active');
      } else {
        desktop.style.display = 'block';
        mobile.style.display = 'none';
        desktopBtn.classList.add('active');
        mobileBtn.classList.remove('active');
      }
    }
  </script>
</head>
<body>
  <a href="index.html" class="back-link">← Back to all previews</a>

  <div class="preview-header">
    <h1>${name}</h1>
    <div class="subject">Subject: ${subject}</div>
    <div class="description">${description}</div>
  </div>

  <div class="preview-controls">
    <span style="font-size: 14px; color: #6b7280; margin-right: 10px;">View:</span>
    <button id="desktop-btn" class="active" onclick="switchView('desktop')">
      🖥️ Desktop
    </button>
    <button id="mobile-btn" onclick="switchView('mobile')">
      📱 Mobile
    </button>
  </div>

  <div id="desktop-view" class="email-container">
    ${emailHtml}
  </div>

  <div id="mobile-view" class="email-container">
    ${emailHtml}
  </div>
</body>
</html>`
}

function createIndexPage(
  previews: Array<{
    name: string
    fileName: string
    description: string
    subject: string
  }>
): string {
  const previewItems = previews
    .map(
      (p) => `
    <div class="preview-card">
      <h3>${p.name}</h3>
      <div class="subject">${p.subject}</div>
      <p>${p.description}</p>
      <a href="${p.fileName}" class="view-button">View Preview →</a>
    </div>
  `
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Template Previews - CashOffers</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 40px 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 32px;
      color: #1e40af;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 16px;
      color: #6b7280;
    }
    .preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }
    .preview-card {
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .preview-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .preview-card h3 {
      font-size: 20px;
      color: #111827;
      margin-bottom: 8px;
    }
    .preview-card .subject {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 12px;
      font-weight: 600;
      padding: 4px 8px;
      background: #f3f4f6;
      border-radius: 4px;
      display: inline-block;
    }
    .preview-card p {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .view-button {
      display: inline-block;
      padding: 10px 20px;
      background: #1e40af;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      transition: background 0.2s;
    }
    .view-button:hover {
      background: #1e3a8a;
    }
    .stats {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      color: #1e40af;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📧 Email Template Previews</h1>
      <div class="subtitle">CashOffers Billing & Subscriptions</div>
    </header>

    <div class="stats">
      <strong>${previews.length} email templates</strong> available for preview.
      All templates are responsive and optimized for mobile and desktop viewing.
    </div>

    <div class="preview-grid">
      ${previewItems}
    </div>
  </div>
</body>
</html>`
}

// Run the generator
generatePreviews().catch((error) => {
  console.error("Failed to generate previews:", error)
  process.exit(1)
})
