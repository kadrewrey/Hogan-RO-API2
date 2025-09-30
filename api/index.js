import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';

// Import route handlers (we'll need to handle this differently for Vercel)
// For now, let's create a minimal working version

let app = null;

async function buildApp() {
  try {
    const fastify = Fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info',
      },
    });

    // Global error handler
    fastify.setErrorHandler((error, _request, reply) => {
      fastify.log.error(error);
      
      if (error.validation) {
        reply.status(400).send({
          error: 'Validation Error',
          details: error.validation
        });
        return;
      }

      if (error.statusCode) {
        reply.status(error.statusCode).send({
          error: error.message
        });
        return;
      }

      reply.status(500).send({
        error: 'Internal Server Error'
      });
    });

    // Register plugins
    await fastify.register(helmet, {
      contentSecurityPolicy: false,
    });

    await fastify.register(cors, {
      origin: true,
      credentials: true,
    });

    await fastify.register(rateLimit, {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    });

    await fastify.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    });

    await fastify.register(swagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'Hogan RO API',
          description: 'Purchase Order Management API',
          version: '2.0.0',
        },
        servers: [
          {
            url: 'https://hogan-ro-api-2.vercel.app',
            description: 'Production server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    });

    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
    });

    // Health check
    fastify.get('/health', async () => {
      return { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: 'production'
      };
    });

    // Basic API info endpoint
    fastify.get('/api', async () => {
      return {
        message: 'Hogan RO API v2.0.0',
        documentation: '/docs',
        health: '/health'
      };
    });

    // Placeholder for other routes - we'll add these back once basic deployment works
    fastify.get('/api/v1/pos', async () => {
      return {
        message: 'Purchase Orders endpoint - authentication required',
        error: 'Not implemented in minimal version'
      };
    });

    return fastify;
  } catch (error) {
    console.error('Error building app:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  try {
    if (!app) {
      console.log('Building Fastify app...');
      app = await buildApp();
      await app.ready();
      console.log('Fastify app ready');
    }
    
    // Use Fastify's inject method for serverless functions
    const response = await app.inject({
      method: req.method,
      url: req.url,
      headers: req.headers,
      payload: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    // Set response headers
    Object.keys(response.headers).forEach((key) => {
      res.setHeader(key, response.headers[key]);
    });

    // Set status and send response
    res.status(response.statusCode).send(response.payload);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};