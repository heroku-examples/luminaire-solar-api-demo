import fp from 'fastify-plugin';

const customAsyncHandlers = {};

// Salesforce plugin for integration with Heroku and Salesforce APIs
export default fp(async function salesforcePlugin(fastify, _opts) {
  const salesforceSdk = await import('@heroku/salesforce-sdk-nodejs');

  // Decorate request w/ 'salesforce' object providing hydrated Salesforce SDK APIs.
  fastify.decorateRequest('salesforce', null);

  /**
   * Salesforce PreHandler to enrich requests. Requests made from
   * External Services contain additional context about the request
   * and invoking org. Context is used to hydrated Salesforce SDK APIs.
   */
  const salesforcePreHandler = async (request, _reply) => {
    // Always parse the request since this handler is only applied to Salesforce routes
    request.sdk = salesforceSdk.init();
    const parsedRequest = request.sdk.salesforce.parseRequest(
      request.headers,
      request.body,
      request.log
    );
    request.sdk = Object.assign(request.sdk, parsedRequest);
  };

  /**
   * Handler for asynchronous APIs to respond to requests immediately and
   * then perform functions. The API may interact with other APIs and/or
   * the invoking org via External Service callback APIs as defined in the
   * operation's OpenAPI spec.
   *
   * @param request
   * @param reply
   * @returns {Promise<void>}
   */
  const asyncHandler = async (request, reply) => {
    request.log.info(
      `Async response for ${request.method} ${request.routeOptions.url}`
    );

    const customAsyncHandler = request.routeOptions.config.salesforce.async;
    if (typeof customAsyncHandler === 'function') {
      try {
        await customAsyncHandler(request, reply);
      } catch (_err) {
        request.log.error(`Error in custom async handler: ${_err}`);
        reply.code(500).send({ message: 'Internal Server Error' });
      }
    } else {
      reply.code(201);
    }
  };

  /**
   * Apply Salesforce preHandlers only to Salesforce routes.
   *
   * This implementation only applies Salesforce middleware to routes
   * that begin with '/salesforce/' or have explicit Salesforce configuration.
   *
   * {config: {salesforce: {async: true || customResponseHandlerFunction}}},
   * When routes are configured as async, true applies the standard 201 response
   * or, if a function is given, the custom handler is invoked to respond to
   * the request.
   */
  fastify.addHook('onRoute', (routeOptions) => {
    const hasSalesforceConfig =
      routeOptions.config && routeOptions.config.salesforce;

    // Check if this is a Salesforce route
    const isSalesforcePath =
      (routeOptions.url && routeOptions.url.includes('/salesforce/')) ||
      (routeOptions.path && routeOptions.path.includes('/salesforce/'));

    // Only add Salesforce preHandler to Salesforce routes or routes with explicit config
    if (isSalesforcePath || hasSalesforceConfig) {
      if (!routeOptions.preHandler) {
        routeOptions.preHandler = [salesforcePreHandler];
      } else if (Array.isArray(routeOptions.preHandler)) {
        routeOptions.preHandler.push(salesforcePreHandler);
      } else {
        routeOptions.preHandler = [
          routeOptions.preHandler,
          salesforcePreHandler,
        ];
      }
    }

    // Configure async response handling if requested
    if (hasSalesforceConfig && routeOptions.config.salesforce.async) {
      const customAsyncHandler = routeOptions.handler;
      routeOptions.handler = asyncHandler;
      customAsyncHandlers[`${routeOptions.method} ${routeOptions.routePath}`] =
        customAsyncHandler;
      fastify.addHook('onResponse', async (request, reply) => {
        const routeIdx = `${request.method} ${request.routeOptions.url}`;
        if (request.sdk && request.sdk.asyncComplete === true) {
          request.log.info(`${routeIdx} is async complete`);
          return;
        }
        const customAsyncHandler = customAsyncHandlers[`${routeIdx}`];
        if (customAsyncHandler) {
          request.log.info(`Found async handle for route index ${routeIdx}`);
          try {
            await customAsyncHandler(request, reply);
          } catch (_err) {
            request.log.error(`Error in custom async handler: ${_err}`);
            reply.code(500).send({ message: 'Internal Server Error' });
          }
          request.sdk.asyncComplete = true;
          request.log.info(`Set async ${routeIdx} completes`);
        }
      });
    }
  });
});
