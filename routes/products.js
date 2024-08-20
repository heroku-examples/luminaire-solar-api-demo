import { productSchema, errorSchema } from '../schemas/index.js';

export default async function (fastify, _opts) {
  fastify.addSchema({
    $id: 'product',
    ...productSchema,
  });

  fastify.addSchema({
    $id: 'error',
    ...errorSchema,
  });

  fastify.get(
    '/products',
    {
      schema: {
        description: 'Get all products',
        tags: ['products'],
        response: {
          200: {
            description: 'All products',
            type: 'array',
            items: { $ref: 'product#' },
          },
          500: {
            description: 'Internal Server Error',
            $ref: 'error#',
          },
        },
      },
    },
    async (request, reply) => {
      const products = await fastify.db.getProducts();
      reply.send(products);
    }
  );

  fastify.get(
    '/products/:id',
    {
      schema: {
        description: 'Get product by id',
        tags: ['products'],
        params: { id: { type: 'string' } },
        response: {
          200: { description: 'Product found', $ref: 'product#' },
          404: { description: 'Product not found', $ref: 'error#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const product = await fastify.db.getProductById(id);
      if (!product) {
        reply.code(404).send({ error: 'Product not found' });
        return;
      }
      reply.send(product);
    }
  );
}
