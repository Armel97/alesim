import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Click the button below to accept the invitation and create your
          account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept Invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this
          email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '"Nunito Sans", Helvetica, Arial, sans-serif',
  padding: '24px 0',
}
const container = {
  padding: '32px 32px 28px',
  maxWidth: '540px',
  border: '1px solid #e6e3d9',
  borderRadius: '20px',
  backgroundColor: '#fbfaf5',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  fontFamily: 'Lora, Georgia, serif',
  color: '#2f3a30',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#55605a',
  lineHeight: '1.6',
  margin: '0 0 22px',
}
const link = { color: '#5b8a63', textDecoration: 'underline' }
const button = {
  backgroundColor: '#5b8a63',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '999px',
  padding: '13px 26px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: '#8b9189',
  lineHeight: '1.6',
  margin: '28px 0 0',
  borderTop: '1px solid #e6e3d9',
  paddingTop: '16px',
}
