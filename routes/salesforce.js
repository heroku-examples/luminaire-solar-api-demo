import {
  salesforceUserSchema,
  salesforceInfoSchema,
  salesforceProductsSchema,
  salesforceSummarySchema,
  salesforceForecastSchema,
  errorSchema,
} from '../schemas/index.js';

export default async function (fastify, _opts) {
  // Register schemas
  fastify.addSchema({
    $id: 'salesforceUser',
    ...salesforceUserSchema,
  });

  fastify.addSchema({
    $id: 'salesforceInfo',
    ...salesforceInfoSchema,
  });

  fastify.addSchema({
    $id: 'salesforceProducts',
    ...salesforceProductsSchema,
  });

  fastify.addSchema({
    $id: 'salesforceSummary',
    ...salesforceSummarySchema,
  });

  fastify.addSchema({
    $id: 'salesforceForecast',
    ...salesforceForecastSchema,
  });

  fastify.addSchema({
    $id: 'error',
    ...errorSchema,
  });
  fastify.get(
    '/salesforce/user',
    {
      config: {
        salesforce: {
          skipAuth: false, // This requires JWT authentication
        },
      },
      schema: {
        operationId: 'getSalesforceUser',
        description:
          'Get authenticated user information including associated Salesforce org/userid for integration with Salesforce services via AppLink.',
        tags: ['salesforce'],
        response: {
          200: {
            description:
              'Successfully retrieved authenticated user information with Salesforce organization and user identifiers for integration with Salesforce services via AppLink.',
            $ref: 'salesforceUser#',
          },
          401: {
            description:
              'Authentication failed due to missing or invalid JWT token',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      if (request.user && request.user.user) {
        return reply.send(request.user.user);
      }

      return reply.send({
        id: 'unauthorized',
        name: 'Not Authenticated',
        sf_org_id: null,
        sf_user_id: null,
        last_name: '',
        username: '',
        email: '',
      });
    }
  );

  /**
   * Endpoint to return company information
   */
  fastify.get(
    '/salesforce/info',
    {
      config: {
        salesforce: {
          skipAuth: true,
        },
      },
      schema: {
        operationId: 'getSalesforceInfo',
        description:
          'Get detailed company information and services offered for Salesforce integration.',
        tags: ['salesforce'],
        response: {
          200: {
            description:
              'Successfully retrieved company information and services offered, formatted for Salesforce integration.',
            $ref: 'salesforceInfo#',
          },
          500: {
            description:
              'Server error occurred while retrieving company information',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      const { logger } = request.sdk;
      logger.info(`GET /salesforce/info`);
      return reply.send({
        description: `
      Luminaire Solar is a leading provider of sustainable energy solutions,
      offering a wide range of services for commercial, residential, and
      industrial clients. Our mission is to power the future with clean,
      renewable energy sources, including both solar and wind energy.
      With years of experience in the energy industry, Luminaire Solar is
      committed to delivering top-quality installations, innovative energy
      solutions, and unmatched customer service. Whether you're looking to
      reduce your carbon footprint at home, optimize energy use in your
      business, or implement large-scale industrial energy projects,
      Luminaire Solar has the expertise and solutions you need.`,
        services: JSON.stringify([
          { description: 'Delivering top-quality installations' },
          { description: 'Reducing your carbon footprint at home' },
          { description: 'Optimizing energy use in your business' },
          {
            description: 'Implementing large-scale industrial energy projects',
          },
        ]),
      });
    }
  );

  /**
   * Get products endpoint
   * Note: This endpoint uses the database function already consolidated in Phase 2
   */
  fastify.get(
    '/salesforce/products',
    {
      config: {
        salesforce: {
          skipAuth: true,
        },
      },
      schema: {
        operationId: 'getSalesforceProducts',
        description:
          'Get complete product catalog formatted for Salesforce integration, including solar panels, batteries, and related equipment.',
        tags: ['salesforce'],
        querystring: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description:
                'Optional filter parameter to filter products by some criteria',
            },
          },
        },
        response: {
          200: {
            description:
              'Successfully retrieved product catalog information as a JSON string for Salesforce integration.',
            $ref: 'salesforceProducts#',
          },
          500: {
            description:
              'Server error occurred while retrieving product catalog',
            $ref: 'error#',
          },
        },
      },
    },
    async (request, reply) => {
      // Get the filter parameter from the query, but ignore it for now
      const filter = request.query.filter;
      // Log the filter if provided (optional)
      if (filter) {
        request.log.info(`Filter parameter provided: ${filter}`);
      }

      // Return all products regardless of filter
      const products = await fastify.db.getProducts();
      return reply.send({ products: JSON.stringify(products) });

      /* Example response:
    {
      products: JSON.stringify([
        {
          "id": "df8c60d2-7975-46cf-95f8-92137dc5e12c",
          "name": "SolarMax PowerBox",
          "description": "This compact and portable solar generator is designed to provide clean and reliable electricity wherever you need it, whether you're camping, working on a remote job site, preparing for emergencies, or simply looking to reduce your environmental footprint.",
          "imageUrl": "https://sfdc-ckz-b2b.s3.amazonaws.com/SDO/w24-product/G-100-2.png",
          "price": "5100.00"
        },
        {
          "id": "e6425e68-a3d9-4bfb-ac68-9b3990a31ac5",
          "name": "Solar Panel",
          "description": "Our state-of-the-art solar panels are designed to harness the power of the sun and provide you with a reliable and environmentally friendly source of electricity for your home or business.",
          "imageUrl": "https://sfdc-ckz-b2b.s3.amazonaws.com/SDO/2021/Solar+Panel/Solar+Panel+1.png",
          "price": "1600.00"
        },
        {
          "id": "2d412207-e80b-4c1f-a678-070ff2092e29",
          "name": "Starter Set",
          "description": "Our Solar Battery, Cables, and Fuses Kit is the ideal solution to supercharge your solar system, providing you with reliability, safety, and seamless power management.",
          "imageUrl": "https://sfdc-ckz-b2b.s3.amazonaws.com/SDO/w24-product/SET-001S-1.png",
          "price": "500.00"
        },
        {
          "id": "ebd873e6-7710-4e64-8f66-dbcf66ca49a2",
          "name": "EnerCharge Pro",
          "description": "The EnerCharge Pro is an advanced energy storage system that empowers homes, businesses, and utilities to efficiently manage their energy resources and reduce electricity costs. Designed with cutting-edge technology and user-friendly features, this ESS is the perfect solution for a sustainable and resilient energy future.",
          "imageUrl": "https://sfdc-ckz-b2b.s3.amazonaws.com/SDO/w24-product/E-2000-1.png",
          "price": "4500.00"
        }
      ])
    }
    */
    }
  );

  /**
   * Get metrics summary by system
   */
  fastify.get(
    '/salesforce/summary/:systemId',
    {
      // TODO: verify in the UI that disabling skipAuth works
      config: {
        salesforce: {
          skipAuth: false,
        },
      },
      schema: {
        operationId: 'getSalesforceMetricsSummary',
        description:
          'Get comprehensive metrics summary for a specific solar system, including daily, weekly, and monthly energy production and consumption data.',
        tags: ['salesforce'],
        params: {
          type: 'object',
          required: ['systemId'],
          properties: {
            systemId: {
              type: 'string',
              description:
                'Unique identifier of the solar system to get metrics for',
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description:
                'Optional date parameter to retrieve metrics for a specific date. If not provided, current date is used.',
            },
          },
        },
        response: {
          200: {
            description:
              'Successfully retrieved energy metrics summary for the specified system, formatted for Salesforce integration.',
            $ref: 'salesforceSummary#',
          },
          401: {
            description:
              'Authentication failed due to missing or invalid JWT token',
            $ref: 'error#',
          },
          404: {
            description:
              'System not found or no metrics available for the specified system',
            $ref: 'error#',
          },
          500: {
            description:
              'Server error occurred while retrieving system metrics',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      const { logger } = request.sdk;
      const { systemId } = request.params;

      logger.info(`GET /salesforce/summary/${systemId}`);
      const date = request.query.date || new Date().toISOString();

      // Use the getMetricsSummaryBySystem function from consolidated DB plugin
      const summary = await fastify.db.getMetricsSummaryBySystem(
        systemId,
        date
      );

      return reply.send({
        daily: JSON.stringify(summary.daily),
        weekly: JSON.stringify(summary.weekly),
        monthly: JSON.stringify(summary.monthly),
      });

      /* Example response:
    {
      "daily": [
        {
          "date": "2025-01-21T05:00:00.000Z",
          "total_energy_produced": "537.60",
          "total_energy_consumed": "480.00"
        },
        {
          "date": "2025-01-20T05:00:00.000Z",
          "total_energy_produced": "537.60",
          "total_energy_consumed": "480.00"
        }
      ],
      "weekly": [
        {
          "date": "2025-01-21T05:00:00.000Z",
          "total_energy_produced": "3225.60",
          "total_energy_consumed": "2880.00"
        }
      ],
      "monthly": [
        {
          "date": "2025-01-01T05:00:00.000Z",
          "total_energy_produced": "16765.40",
          "total_energy_consumed": "14900.00"
        }
      ]
    }
    */
    }
  );

  /**
   * Get energy forecast by system
   */
  fastify.get(
    '/salesforce/forecast/:systemId',
    {
      // TODO: verify in the UI that disabling skipAuth works
      config: {
        salesforce: {
          skipAuth: false,
        },
      },
      schema: {
        operationId: 'getSalesforceForecast',
        description:
          'Get energy production forecast for a specific solar system, providing predicted energy generation based on weather patterns and system capabilities.',
        tags: ['salesforce'],
        params: {
          type: 'object',
          required: ['systemId'],
          properties: {
            systemId: {
              type: 'string',
              description:
                'Unique identifier of the solar system to get forecast for',
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description:
                'Optional date parameter to retrieve forecast from a specific date. If not provided, current date is used.',
            },
          },
        },
        response: {
          200: {
            description:
              'Successfully retrieved energy forecast for the specified system, formatted for Salesforce integration.',
            $ref: 'salesforceForecast#',
          },
          401: {
            description:
              'Authentication failed due to missing or invalid JWT token',
            $ref: 'error#',
          },
          404: {
            description:
              'System not found or no forecast available for the specified system',
            $ref: 'error#',
          },
          500: {
            description:
              'Server error occurred while retrieving system forecast',
            $ref: 'error#',
          },
        },
      },
    },
    async function (request, reply) {
      const { systemId } = request.params;
      const date = request.query.date || new Date().toISOString();

      const forecast = await fastify.db.getEnergyForecast(systemId, date);
      return reply.send({ forecast: JSON.stringify(forecast) });

      /* Example response:
    {
      "forecast": [
        {
          "date": "Wed May 01 2025",
          "irradiation": 6
        },
        {
          "date": "Thu May 02 2025",
          "irradiation": 6
        },
        {
          "date": "Fri May 03 2025",
          "irradiation": 6
        },
        {
          "date": "Sat May 04 2025",
          "irradiation": 3
        },
        {
          "date": "Sun May 05 2025",
          "irradiation": 2
        },
        {
          "date": "Mon May 06 2025",
          "irradiation": 6
        },
        {
          "date": "Tue May 07 2025",
          "irradiation": 6
        }
      ]
    }
    */
    }
  );
}
