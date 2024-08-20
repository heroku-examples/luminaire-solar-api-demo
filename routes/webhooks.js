export default async function (fastify, _opts) {
  fastify.post('/webhook', async function (request, reply) {
    const payload = request.body;
    fastify.log.info(payload);
    reply.send({ status: 'success' });
  });

  fastify.post('/notify', async function (request, reply) {
    const payload = request.body;
    fastify.log.info(payload);
    reply.send({ status: 'success' });
  });
}
