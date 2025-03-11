export default async function (fastify, _opts) {
  fastify.post(
    '/webhook',
    {
      schema: {
        operationId: 'receiveWebhook',
        description:
          'Receives external webhook notifications from integrated systems and services. This endpoint acts as a general-purpose listener for events from third-party services, processing incoming data and triggering appropriate actions within the solar monitoring system.',
        body: {
          type: 'object',
          description:
            'Webhook payload containing event data from external systems',
          additionalProperties: true,
        },
        response: {
          200: {
            description:
              'Successfully received and acknowledged the webhook notification',
            type: 'object',
            properties: {
              status: {
                type: 'string',
                description: 'Status of the webhook processing operation',
              },
            },
          },
        },
        tags: ['webhooks'],
      },
    },
    async function (request, reply) {
      const payload = request.body;
      fastify.log.info(payload);
      reply.send({ status: 'success' });
    }
  );

  fastify.post(
    '/notify',
    {
      schema: {
        operationId: 'receiveNotification',
        description:
          'Receives notification events specifically related to solar system status changes or alerts. This endpoint processes important updates about system performance, maintenance needs, or critical alerts that require attention.',
        body: {
          type: 'object',
          description:
            'Notification payload containing alert or status update information',
          additionalProperties: true,
        },
        response: {
          200: {
            description: 'Successfully received and processed the notification',
            type: 'object',
            properties: {
              status: {
                type: 'string',
                description: 'Status of the notification processing operation',
              },
            },
          },
        },
        tags: ['notifications'],
      },
    },
    async function (request, reply) {
      const payload = request.body;
      fastify.log.info(payload);
      reply.send({ status: 'success' });
    }
  );
}
