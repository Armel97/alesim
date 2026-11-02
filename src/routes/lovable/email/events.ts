import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { recordEmailEvent } from '@/lib/email-diagnostics.server'

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            // Journalisation pour diagnostic. Idempotent : dedupe sur event_id.
            'email.bounced': async (event) => {
              console.log('Email bounced', { event_id: event.event_id })
              await recordEmailEvent({
                eventId: event.event_id,
                eventType: 'bounced',
                recipient: event.data.recipient,
                messageId: event.data.message_id,
              })
            },
            'email.complaint': async (event) => {
              console.log('Email complaint', { event_id: event.event_id })
              await recordEmailEvent({
                eventId: event.event_id,
                eventType: 'complained',
                recipient: event.data.recipient,
                messageId: event.data.message_id,
              })
            },
            'email.unsubscribed': async (event) => {
              console.log('Email unsubscribed', { event_id: event.event_id })
              await recordEmailEvent({
                eventId: event.event_id,
                eventType: 'unsubscribed',
                recipient: event.data.recipient,
                messageId: event.data.message_id,
              })
            },
          },
        })
        return handler(request)
      },
    },
  },
})
