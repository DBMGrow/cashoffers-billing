import {
  Html,
  Head,
  Body,
  Container,
  Preview,
} from '@react-email/components'
import { colors, font } from './tokens'

interface EmailLayoutProps {
  title: string
  preview: string
  children: React.ReactNode
}

/**
 * Root email shell — Html, Head, Body, and Container.
 * All transactional emails should be wrapped in this.
 */
export function EmailLayout({ title, preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.bg.page,
          fontFamily: font.family,
          margin: '0',
          padding: '0',
          WebkitTextSizeAdjust: '100%',
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '0',
          }}
        >
          {children}
        </Container>
      </Body>
    </Html>
  )
}
