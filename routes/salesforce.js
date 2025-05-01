/**
 * These routes are part of initial integration and maintain backward compatibility
 * TODO: refined API consolidation
 */
export default async function (fastify, _opts) {
  /**
   * Mock endpoint to get user info
   */
  fastify.get(
    '/user',
    {
      config: {
        salesforce: {
          parseRequest: true,
          skipAuth: true, // For demo purposes, real implementation should use proper auth
        },
      },
      schema: {
        description: 'Get user information',
        tags: ['salesforce'],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },
    },
    async function (request, _reply) {
      const { logger } = request.sdk;
      logger.info('GET /user');
      return {
        id: 'user_id_1',
        name: 'user_name_1',
      };
    }
  );

  /**
   * Endpoint to return company information
   */
  fastify.get(
    '/info',
    {
      config: {
        salesforce: {
          parseRequest: true,
          skipAuth: true, // For demo purposes
        },
      },
      schema: {
        description: 'Get company information',
        tags: ['salesforce'],
        response: {
          200: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              services: { type: 'string' },
            },
          },
        },
      },
    },
    async function (request, _reply) {
      const { logger } = request.sdk;
      logger.info(`GET /info`);
      return {
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
      };
    }
  );

  /**
   * Get products endpoint
   * Note: This endpoint uses the database function already consolidated in Phase 2
   */
  fastify.get(
    '/products',
    {
      config: {
        salesforce: {
          parseRequest: true,
          skipAuth: true, // For demo purposes
        },
      },
      schema: {
        description: 'Get product catalog',
        tags: ['salesforce'],
        response: {
          200: {
            type: 'object',
            properties: {
              products: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      const products = await fastify.db.getProducts();
      _reply.send({ products: JSON.stringify(products) });

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
    '/summary/:systemId',
    {
      config: {
        salesforce: {
          parseRequest: true,
          skipAuth: true, // For demo purposes
        },
      },
      schema: {
        description: 'Get metrics summary by system',
        tags: ['salesforce'],
        params: {
          type: 'object',
          required: ['systemId'],
          properties: {
            systemId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            date: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              daily: { type: 'string' },
              weekly: { type: 'string' },
              monthly: { type: 'string' },
            },
          },
        },
      },
    },
    async function (request, _reply) {
      const { logger } = request.sdk;
      const { systemId } = request.params;

      logger.info(`GET /summary/${systemId}`);
      const date = request.query.date || new Date().toISOString();

      // Use the getMetricsSummaryBySystem function from consolidated DB plugin
      const summary = await fastify.db.getMetricsSummaryBySystem(
        systemId,
        date
      );

      _reply.send({
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
    '/forecast/:systemId',
    {
      config: {
        salesforce: {
          parseRequest: true,
          skipAuth: true, // For demo purposes
        },
      },
      schema: {
        description: 'Get energy forecast by system',
        tags: ['salesforce'],
        params: {
          type: 'object',
          required: ['systemId'],
          properties: {
            systemId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            date: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              forecast: { type: 'string' },
            },
          },
        },
      },
    },
    async function (request, reply) {
      const { systemId } = request.params;
      const date = request.query.date || new Date().toISOString();

      const forecast = await fastify.db.getEnergyForecast(systemId, date);
      reply.send({ forecast: JSON.stringify(forecast) });

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

  /**
   * Handle Data Cloud data change event
   */
  fastify.post(
    '/handleDataCloudDataChangeEvent',
    {
      config: {
        salesforce: {
          parseRequest: false, // Parsing is specific to External Service requests
          skipAuth: true, // This endpoint is called by Salesforce and doesn't use our JWT authentication
        },
      },
      schema: {
        description: 'Handle Data Cloud data change events',
        tags: ['salesforce'],
      },
    },
    async function (request, reply) {
      const logger = request.log;
      const dataCloud = request.sdk.dataCloud;

      if (!request.body) {
        logger.warn('Empty body, no events found');
        return reply.code(400).send();
      }

      const actionEvent = dataCloud.parseDataActionEvent(request.body);
      logger.info(
        `POST /dataCloudDataChangeEvent: ${actionEvent.count} events for schemas ${Array.isArray(actionEvent.schemas) && actionEvent.schemas.length > 0 ? actionEvent.schemas.map((s) => s.schemaId).join() : 'n/a'}`
      );

      // Loop through event data
      actionEvent.events.forEach((evt) => {
        logger.info(
          `Got action '${evt.ActionDeveloperName}', event type '${evt.EventType}' triggered by ${evt.EventPrompt} on object '${evt.SourceObjectDeveloperName}' published on ${evt.EventPublishDateTime}`
        );
        // Handle changed object values via evt.PayloadCurrentValue
      });

      // If config vars are set, query Data Cloud org
      if (process.env.DATA_CLOUD_ORG && process.env.DATA_CLOUD_QUERY) {
        const orgName = process.env.DATA_CLOUD_ORG;
        const query = process.env.DATA_CLOUD_QUERY;
        const herokuIntegration = request.sdk.addons.herokuIntegration;

        // Get DataCloud org connection from add-on
        logger.info(
          `Getting '${orgName}' org connection from Heroku Integration add-on...`
        );
        const org = await herokuIntegration.getConnection(orgName);

        // Query DataCloud org
        logger.info(`Querying org ${org.id}: ${query}`);
        const response = await org.dataCloudApi.query(query);
        logger.info(`Query response: ${JSON.stringify(response.data || {})}`);
      }

      reply.code(201).send();
    }
  );
}
