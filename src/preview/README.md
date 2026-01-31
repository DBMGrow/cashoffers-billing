# Email Preview System

This directory contains tools for previewing MJML email templates with sample data.

## Quick Start

Generate all email previews:

```bash
npm run preview:emails
```

This will:
1. Compile all MJML templates to HTML
2. Insert sample data from `email-preview-data.ts`
3. Generate preview files in the `email-previews/` directory
4. Create an index page to view all templates

## Opening Previews

After generating previews, open in your browser:

```bash
# macOS
open email-previews/index.html

# Linux
xdg-open email-previews/index.html

# Windows
start email-previews/index.html
```

Or simply navigate to the project root and double-click `email-previews/index.html`.

## Preview Features

### Index Page (`index.html`)
- Grid view of all email templates
- Quick links to individual previews
- Template descriptions and subjects

### Individual Template Previews
- Desktop and mobile view toggle
- Template name and description
- Sample subject line
- Responsive layout testing
- Back link to index

## Files

### `email-preview-data.ts`
Contains sample data for all email templates. Edit this file to:
- Add new templates
- Update sample data
- Change preview variables

### `generate-previews.ts`
The preview generator script. Features:
- Compiles MJML to HTML
- Wraps emails in preview frame
- Generates index page
- Console logging of progress

## Adding New Templates

1. Create your MJML template in `src/templates/mjml/`
2. Add sample data to `email-preview-data.ts`:

```typescript
{
  name: "My New Email",
  template: "my-new-email.mjml",
  subject: "Subject Line Here",
  variables: {
    name: "John Doe",
    amount: "$100.00",
  },
  description: "Description of when this email is sent",
}
```

3. Run `npm run preview:emails` to regenerate

## Template Variables

All templates support variable substitution using `{{variable}}` syntax:

```mjml
<mj-text>Hello {{name}}</mj-text>
<mj-text>Amount: {{amount}}</mj-text>
```

## Common Variables

Most templates use these standard variables:
- `amount` - Monetary amount (e.g., "$250.00")
- `date` - Transaction date (e.g., "January 31, 2024")
- `subscription` - Subscription name (e.g., "Premium Plan")
- `name` - User name
- `email` - User email
- `link` - Action URL

## Preview Output

The `email-previews/` directory is:
- ✅ Git-ignored (added to `.gitignore`)
- ✅ Regenerated on each run
- ✅ Safe to delete (can be regenerated anytime)

## Development Workflow

1. **Design**: Edit MJML templates in `src/templates/mjml/`
2. **Preview**: Run `npm run preview:emails`
3. **Review**: Open `email-previews/index.html` in browser
4. **Test**: Toggle desktop/mobile views
5. **Iterate**: Make changes and regenerate

## Responsive Testing

All templates are responsive and optimized for:
- **Desktop**: Full width (600px email container)
- **Mobile**: Narrow width (375px preview)

Use the view toggle buttons in each preview to test both layouts.

## Tips

- Keep sample data realistic to catch layout issues
- Test with long and short text to ensure flexibility
- Use actual monetary amounts and dates
- Test all variable combinations
- Check special characters render correctly

## Troubleshooting

### Preview Generation Fails

```bash
# Check TypeScript compilation
npm run build

# Check MJML templates are valid
ls src/templates/mjml/*.mjml
```

### Variables Not Replacing

Ensure variables in `email-preview-data.ts` match those in your MJML template:

```typescript
// In email-preview-data.ts
variables: { userName: "John" }

// In template.mjml - must match!
<mj-text>{{userName}}</mj-text>
```

### Missing Templates

If a template doesn't appear in previews:
1. Check it's added to `emailPreviews` array in `email-preview-data.ts`
2. Verify the template file exists in `src/templates/mjml/`
3. Check the filename matches exactly (case-sensitive)

## Future Enhancements

Possible improvements:
- [ ] Live preview server with hot reload
- [ ] Email sending test (send to test address)
- [ ] Screenshot generation for documentation
- [ ] A/B testing variations
- [ ] Variable editor in preview UI
- [ ] Dark mode preview
- [ ] Accessibility testing tools
