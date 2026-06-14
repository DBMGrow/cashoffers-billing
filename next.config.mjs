import { createMDX } from 'fumadocs-mdx/next'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow whitelabel logos served from DigitalOcean Spaces buckets (staging + prod)
  // through next/image. Without this, next/image rejects the external host.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.nyc3.digitaloceanspaces.com',
      },
    ],
  },
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

const withMDX = createMDX()

export default withMDX(nextConfig)
