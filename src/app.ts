import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import multipart from '@fastify/multipart'

// Import route handlers
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { roleRoutes } from './routes/roles'
import { permissionRoutes } from './routes/permissions'
import { purchaseOrderRoutes } from './routes/purchase-orders'
import { supplierRoutes } from './routes/suppliers'
import { deliveryAddressRoutes } from './routes/delivery-addresses'
import { divisionRoutes } from './routes/divisions'
import { fileRoutes } from './routes/files'
import { exportRoutes } from './routes/exports'
import { adminRoutes } from './routes/admin'

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development'
const IS_VERCEL = process.env.VERCEL === '1'

export async function build() {
  const fastify = Fastify({
    logger: NODE_ENV === 'development' ? {
      level: process.env.LOG_LEVEL || 'info',
    } : {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  // Global error handler
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error)
    
    if (error.validation) {
      reply.status(400).send({
        error: 'Validation Error',
        details: error.validation
      })
      return
    }

    if (error.statusCode) {
      reply.status(error.statusCode).send({
        error: error.message
      })
      return
    }

    reply.status(500).send({
      error: 'Internal Server Error'
    })
  })

  // Register plugins
  // Security
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable CSP for API
  })

  // CORS
  await fastify.register(cors, {
    origin: true, // Allow all origins
    credentials: true,
  })

  // Rate limiting
  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  })

  // File upload support
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  })

  // Swagger documentation
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
          url: IS_VERCEL ? 'https://your-app.vercel.app' : `http://localhost:${process.env.PORT || 3002}`,
          description: IS_VERCEL ? 'Production server' : 'Development server',
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
  })

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
  })

  // Register routes
  // Health check
  fastify.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: NODE_ENV
    }
  })

  // API routes
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' })
  await fastify.register(userRoutes, { prefix: '/api/v1/users' })
  await fastify.register(roleRoutes, { prefix: '/api/roles' })
  await fastify.register(permissionRoutes, { prefix: '/api/permissions' })
  await fastify.register(purchaseOrderRoutes, { prefix: '/api/v1/pos' })
  await fastify.register(supplierRoutes, { prefix: '/api/v1/suppliers' })
  await fastify.register(deliveryAddressRoutes, { prefix: '/api/v1/delivery-addresses' })
  await fastify.register(divisionRoutes, { prefix: '/api/v1/divisions' })
  await fastify.register(fileRoutes, { prefix: '/api/v1/files' })
  await fastify.register(exportRoutes, { prefix: '/api/v1/exports' })
  await fastify.register(adminRoutes, { prefix: '/api/v1/admin' })

  return fastify
}