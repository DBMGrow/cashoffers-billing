import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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

export default nextConfig
