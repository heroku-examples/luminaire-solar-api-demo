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
    // Debug logging for Salesforce Agent requests
    request.log.info('=== Salesforce PreHandler Debug ===');
    request.log.info(`Route: ${request.method} ${request.url}`);
    request.log.info(`Headers received:`, {
      'x-client-context': request.headers['x-client-context']
        ? 'present'
        : 'missing',
      authorization: request.headers['authorization'] ? 'present' : 'missing',
      'user-agent': request.headers['user-agent'],
      'all-headers': Object.keys(request.headers).join(', '),
    });

    // Log the actual x-client-context if present (be careful not to log sensitive data)
    if (request.headers['x-client-context']) {
      try {
        const clientContext = JSON.parse(request.headers['x-client-context']);
        request.log.info('x-client-context parsed:', {
          hasOrgId: !!clientContext.orgId,
          hasUserId: !!clientContext.userId,
          hasUserContext: !!clientContext.userContext,
          keys: Object.keys(clientContext).join(', '),
        });
      } catch (e) {
        request.log.error('Failed to parse x-client-context:', e.message);
      }
    }

    request.sdk = salesforceSdk.init();

    // Always parse the request since this handler is only applied to Salesforce routes
    const parsedRequest = request.sdk.salesforce.parseRequest(
      request.headers,
      request.body,
      request.log
    );
    request.sdk = Object.assign(request.sdk, parsedRequest);

    // Log what the SDK parsed
    request.log.info('SDK parsed request:', {
      hasSalesforceContext: !!request.sdk.salesforce,
      hasOrgId: !!request.sdk.salesforce?.orgId,
      hasUserId: !!request.sdk.salesforce?.userId,
    });
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

  /**
   * JWT Authentication integration
   * This ensures Salesforce endpoints require proper JWT authentication
   * when needed, aligning with api-demo's authentication approach
   */
  fastify.addHook('preHandler', async (request, reply) => {
    const routeOptions = request.routeOptions;
    const hasSalesforceConfig =
      routeOptions.config && routeOptions.config.salesforce;

    // Log when we're processing a Salesforce route
    if (hasSalesforceConfig) {
      request.log.info('=== Salesforce Route Processing ===');
      request.log.info('Route config:', {
        route: `${request.method} ${request.url}`,
        hasSalesforceConfig: true,
        skipAuth: routeOptions.config.salesforce.skipAuth,
        hasXClientContext: !!request.headers['x-client-context'],
        hasAuthorization: !!request.headers.authorization,
      });
    }

    // Skip JWT verification for routes explicitly marked as not requiring auth
    if (
      hasSalesforceConfig &&
      routeOptions.config.salesforce.skipAuth === true
    ) {
      request.log.info('Skipping JWT auth - route marked as skipAuth: true');
      return;
    }

    // For other Salesforce routes, check authentication
    if (hasSalesforceConfig && !request.routeOptions.config.skipAuth) {
      request.log.info('=== Authentication Check ===');
      request.log.info('Route requires auth:', {
        route: `${request.method} ${request.url}`,
        hasAuthHeader: !!request.headers.authorization,
        authHeaderValue: request.headers.authorization
          ? 'Bearer [REDACTED]'
          : 'missing',
        hasClientContext: !!request.headers['x-client-context'],
        userAgent: request.headers['user-agent'],
      });

      // Check if we have valid x-client-context from Salesforce/AppLink
      const hasValidClientContext =
        request.headers['x-client-context'] && request.sdk?.salesforce?.orgId;

      if (hasValidClientContext) {
        request.log.info(
          'Valid x-client-context found - accepting Salesforce/AppLink auth'
        );
        request.log.info('Salesforce context:', {
          hasOrgId: !!request.sdk.salesforce.orgId,
          hasUserId: !!request.sdk.salesforce.userId,
          orgId: request.sdk.salesforce.orgId
            ? `${request.sdk.salesforce.orgId.substring(0, 8)}...`
            : 'missing',
        });

        // Set a synthetic user object for compatibility with routes expecting request.user
        if (!request.user) {
          request.user = {
            user: {
              id: request.sdk.salesforce.userId || 'salesforce-agent',
              username: 'salesforce-agent',
              sf_org_id: request.sdk.salesforce.orgId,
              sf_user_id: request.sdk.salesforce.userId,
              email: 'agent@salesforce.com',
              name: 'Salesforce Agent',
              last_name: 'Agent',
            },
          };
          request.log.info(
            'Created synthetic user object for Salesforce agent'
          );
        }

        // Skip JWT verification since we have valid Salesforce context
        return;
      }

      // Otherwise, require JWT authentication
      request.log.info('No valid x-client-context, checking JWT auth...');

      try {
        await request.jwtVerify();
        request.log.info('JWT verification successful');
      } catch (err) {
        request.log.error('=== Authentication Failed ===');
        request.log.error(`Error message: ${err.message}`);
        request.log.error(`Error code: ${err.code}`);
        request.log.error(`Full error:`, err);

        // Check if this is the specific "No Authorization was found" error
        if (err.message.includes('No Authorization was found')) {
          request.log.error(
            'No Authorization header and no valid x-client-context'
          );
          request.log.error(
            'Headers at time of error:',
            Object.keys(request.headers).join(', ')
          );
        }

        // Send back the exact error format that matches what the agent expects
        reply.code(401).send({
          error: 'JWT verification failed',
          message: err.message || 'Unauthorized access',
        });
      }
    }
  });
});
