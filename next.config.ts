/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Externalize backend packages that shouldn't be bundled
  serverExternalPackages: [
    'mjml',
    'mysql2',
    'square',
    '@sendgrid/mail',
    'bcrypt',
    'kysely',
  ],
}

module.exports = nextConfig
