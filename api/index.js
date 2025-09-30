import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Database setup
const sql = neon(process.env.DATABASE_URL || 'dummy-url-for-local-testing');

// Auth utilities
function generateUUID() {
  return crypto.randomUUID();
}

function requireAuth(request) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header required');
  }
  
  const token = authHeader.substring(7);
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'dummy-secret');
  } catch (error) {
    throw new Error('Invalid token');
  }
}

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

    // Register simplified route handlers
    try {
      // Purchase Orders routes
      fastify.get('/api/v1/pos', async (request, reply) => {
        try {
          const user = requireAuth(request);
          
          const query = request.query || {};
          const page = parseInt(query.page || '1');
          const limit = Math.min(parseInt(query.limit || '50'), 100);
          const offset = (page - 1) * limit;

          const purchaseOrders = await sql`
            SELECT 
              po.id,
              po.po_number,
              po.status,
              po.order_date,
              po.expected_delivery_date,
              po.total_amount,
              po.currency,
              po.notes,
              po.created_at,
              po.updated_at,
              json_build_object(
                'id', s.id,
                'name', s.name,
                'contact_email', s.contact_email,
                'contact_phone', s.contact_phone
              ) as supplier,
              COUNT(poi.id) as item_count
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id AND s.deleted_at IS NULL
            LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id AND poi.deleted_at IS NULL
            WHERE po.deleted_at IS NULL
            GROUP BY po.id, po.po_number, po.status, po.order_date, po.expected_delivery_date, 
                     po.total_amount, po.currency, po.notes, po.created_at, po.updated_at,
                     s.id, s.name, s.contact_email, s.contact_phone
            ORDER BY po.order_date DESC, po.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `;

          const [{ count: totalCount }] = await sql`
            SELECT COUNT(*) as count FROM purchase_orders po WHERE po.deleted_at IS NULL
          `;

          const totalPages = Math.ceil(parseInt(totalCount) / limit);

          return {
            purchase_orders: purchaseOrders,
            pagination: {
              current_page: page,
              total_pages: totalPages,
              total_count: parseInt(totalCount),
              per_page: limit,
            },
          };

        } catch (error) {
          fastify.log.error(error, 'Error fetching purchase orders:');
          return reply.status(500).send({ error: 'Failed to fetch purchase orders' });
        }
      });

      // POST endpoint for creating purchase orders
      fastify.post('/api/v1/pos', {
        schema: {
          body: {
            type: 'object',
            required: ['po_number', 'supplier_id', 'order_date', 'total_amount', 'items'],
            properties: {
              po_number: { type: 'string', minLength: 1, maxLength: 100 },
              supplier_id: { type: 'string', format: 'uuid' },
              status: {
                type: 'string',
                enum: ['draft', 'pending', 'approved', 'ordered', 'received', 'cancelled'],
                default: 'draft',
              },
              order_date: { type: 'string', format: 'date-time' },
              expected_delivery_date: { type: 'string', format: 'date-time' },
              total_amount: { type: 'number', minimum: 0 },
              currency: { type: 'string', minLength: 3, maxLength: 3 },
              notes: { type: 'string' },
              items: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  required: ['description', 'quantity', 'unit_price', 'total_price'],
                  properties: {
                    description: { type: 'string', minLength: 1 },
                    quantity: { type: 'number', minimum: 1 },
                    unit_price: { type: 'number', minimum: 0 },
                    total_price: { type: 'number', minimum: 0 },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      }, async (request, reply) => {
        try {
          const user = requireAuth(request);
          const data = request.body;

          // Check if PO number already exists
          const [existingPO] = await sql`
            SELECT id FROM purchase_orders WHERE po_number = ${data.po_number} AND deleted_at IS NULL
          `;

          if (existingPO) {
            return reply.status(400).send({ error: 'Purchase order number already exists' });
          }

          // Create purchase order
          const poId = generateUUID();
          const now = new Date().toISOString();
          
          const [newPO] = await sql`
            INSERT INTO purchase_orders (
              id, po_number, supplier_id, status, order_date, expected_delivery_date,
              total_amount, currency, notes, created_at, updated_at, created_by, updated_by
            ) VALUES (
              ${poId}, ${data.po_number}, ${data.supplier_id}, ${data.status || 'draft'},
              ${data.order_date}, ${data.expected_delivery_date}, ${data.total_amount},
              ${data.currency || 'USD'}, ${data.notes}, ${now}, ${now},
              ${user.id}, ${user.id}
            ) RETURNING id, po_number, status, order_date, expected_delivery_date, 
                       total_amount, currency, notes, created_at, updated_at
          `;

          // Create purchase order items
          const items = [];
          for (const item of data.items) {
            const itemId = generateUUID();
            const [newItem] = await sql`
              INSERT INTO purchase_order_items (
                id, purchase_order_id, description, quantity, unit_price, total_price, notes,
                created_at, updated_at, created_by, updated_by
              ) VALUES (
                ${itemId}, ${newPO.id}, ${item.description},
                ${item.quantity}, ${item.unit_price}, ${item.total_price}, ${item.notes},
                ${now}, ${now}, ${user.id}, ${user.id}
              ) RETURNING id, description, quantity, unit_price, total_price, notes
            `;
            items.push(newItem);
          }

          return reply.status(201).send({ 
            purchase_order: { ...newPO, items } 
          });

        } catch (error) {
          fastify.log.error(error, 'Error creating purchase order:');
          return reply.status(500).send({ error: 'Failed to create purchase order' });
        }
      });
      
      console.log('Routes registered successfully');
    } catch (routeError) {
      console.error('Error registering routes:', routeError);
      // Continue without failing completely
    }

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