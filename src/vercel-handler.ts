import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import multipart from '@fastify/multipart'
import type { VercelRequest, VercelResponse } from '@vercel/node'

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

let app: any = null

async function buildApp() {
  const fastify = Fastify({
    logger: {
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
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  })

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  })

  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  })

  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  })

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
          url: 'https://your-app.vercel.app',
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
  })

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
  })

  // Health check
  fastify.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: 'production'
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!app) {
    app = await buildApp()
    await app.ready()
  }
  
  return app.server(req, res)
}