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
        operationId: 'getAllProducts',
        description:
          'Retrieves a comprehensive catalog of all available solar products and equipment in the system. This endpoint provides complete product information including names, descriptions, images, and pricing to help customers make informed purchasing decisions.',
        tags: ['products'],
        response: {
          200: {
            description:
              'Successfully retrieved the complete list of solar products and equipment with all details including names, descriptions, images, and pricing information.',
            type: 'array',
            items: { $ref: 'product#' },
          },
          500: {
            description:
              'Server encountered an unexpected error while retrieving product data. The error details provide information about what went wrong during the operation.',
            $ref: 'error#',
          },
        },
      },
    },
    async (_request, reply) => {
      const products = await fastify.db.getProducts();
      let additionalProducts = [];
      try {
        additionalProducts = await fastify.db.getAdditionalProducts();
      } catch (err) {
        fastify.log.error(
          { error: err.message },
          'Error getting Salesforce products'
        );
      }
      return reply.send([...products, ...additionalProducts]);
    }
  );

  fastify.get(
    '/products/:id',
    {
      schema: {
        operationId: 'getProductById',
        description:
          'Retrieves detailed information about a specific solar product by its unique identifier. This endpoint provides comprehensive product details including name, description, image, pricing, and product code for a single product item.',
        tags: ['products'],
        params: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description:
                'Unique identifier (UUID) of the specific solar product to retrieve',
            },
          },
        },
        response: {
          200: {
            description:
              'Successfully retrieved the requested solar product with complete details including name, description, image, pricing, and product code.',
            $ref: 'product#',
          },
          404: {
            description:
              'The requested solar product could not be found. This may occur if the product ID is invalid or if the product has been removed from the catalog.',
            $ref: 'error#',
          },
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
      return reply.send(product);
    }
  );
}
