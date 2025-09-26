// routes/purchase-orders.ts
// Purchase order management routes for Fastify

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import sql, { withCreateAudit, withUpdateAudit } from '../lib/db';
import { requireAuth, requireRole, isValidUUID } from '../lib/auth';

// Validation schemas
const createPurchaseOrderSchema = z.object({
  po_number: z.string().min(1).max(100),
  supplier_id: z.string().uuid(),
  status: z.enum(['draft', 'pending', 'approved', 'ordered', 'received', 'cancelled']).default('draft'),
  order_date: z.string().transform((str) => new Date(str)),
  expected_delivery_date: z.string().transform((str) => new Date(str)).optional(),
  total_amount: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  notes: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(1),
    unit_price: z.number().min(0),
    total_price: z.number().min(0),
    notes: z.string().optional(),
  })),
});



export async function purchaseOrderRoutes(fastify: FastifyInstance) {
  // Get all purchase orders
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager', 'user']);

      const query = request.query as {
        status?: string;
        supplier_id?: string;
        from_date?: string;
        to_date?: string;
        search?: string;
        page?: string;
        limit?: string;
      };

      const page = parseInt(query.page || '1');
      const limit = Math.min(parseInt(query.limit || '50'), 100);
      const offset = (page - 1) * limit;

      // Build where conditions
      let whereConditions = sql`WHERE po.deleted_at IS NULL`;
      
      if (query.status) {
        whereConditions = sql`${whereConditions} AND po.status = ${query.status}`;
      }
      
      if (query.supplier_id && isValidUUID(query.supplier_id)) {
        whereConditions = sql`${whereConditions} AND po.supplier_id = ${query.supplier_id}`;
      }
      
      if (query.from_date) {
        whereConditions = sql`${whereConditions} AND po.order_date >= ${new Date(query.from_date)}`;
      }
      
      if (query.to_date) {
        whereConditions = sql`${whereConditions} AND po.order_date <= ${new Date(query.to_date)}`;
      }
      
      if (query.search) {
        whereConditions = sql`${whereConditions} AND (
          po.po_number ILIKE ${'%' + query.search + '%'} OR
          po.notes ILIKE ${'%' + query.search + '%'} OR
          s.name ILIKE ${'%' + query.search + '%'}
        )`;
      }

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
        ${whereConditions}
        GROUP BY po.id, po.po_number, po.status, po.order_date, po.expected_delivery_date, 
                 po.total_amount, po.currency, po.notes, po.created_at, po.updated_at,
                 s.id, s.name, s.contact_email, s.contact_phone
        ORDER BY po.order_date DESC, po.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      // Get total count for pagination
      const [{ count: totalCount }] = await sql`
        SELECT COUNT(*) as count
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id AND s.deleted_at IS NULL
        ${whereConditions}
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

  // Get purchase order by ID
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager', 'user']);

      const { id } = request.params as { id: string };

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid purchase order ID format' });
      }

      const [purchaseOrder] = await sql`
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
            'contact_name', s.contact_name,
            'contact_email', s.contact_email,
            'contact_phone', s.contact_phone,
            'address', s.address,
            'city', s.city,
            'state', s.state,
            'zip_code', s.zip_code,
            'country', s.country
          ) as supplier,
          COALESCE(
            json_agg(
              json_build_object(
                'id', poi.id,
                'description', poi.description,
                'quantity', poi.quantity,
                'unit_price', poi.unit_price,
                'total_price', poi.total_price,
                'notes', poi.notes
              ) ORDER BY poi.created_at
            ) FILTER (WHERE poi.id IS NOT NULL),
            '[]'::json
          ) as items
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id AND s.deleted_at IS NULL
        LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id AND poi.deleted_at IS NULL
        WHERE po.id = ${id} AND po.deleted_at IS NULL
        GROUP BY po.id, po.po_number, po.status, po.order_date, po.expected_delivery_date,
                 po.total_amount, po.currency, po.notes, po.created_at, po.updated_at,
                 s.id, s.name, s.contact_name, s.contact_email, s.contact_phone,
                 s.address, s.city, s.state, s.zip_code, s.country
      `;

      if (!purchaseOrder) {
        return reply.status(404).send({ error: 'Purchase order not found' });
      }

      return { purchase_order: purchaseOrder };

    } catch (error) {
      fastify.log.error(error, 'Error fetching purchase order:');
      return reply.status(500).send({ error: 'Failed to fetch purchase order' });
    }
  });

  // Create new purchase order
  fastify.post('/', {
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager']);

      const data = createPurchaseOrderSchema.parse(request.body);

      // Check if PO number already exists
      const [existingPO] = await sql`
        SELECT id FROM purchase_orders WHERE po_number = ${data.po_number} AND deleted_at IS NULL
      `;

      if (existingPO) {
        return reply.status(400).send({ error: 'Purchase order number already exists' });
      }

      // Verify supplier exists
      const [supplier] = await sql`
        SELECT id FROM suppliers WHERE id = ${data.supplier_id} AND deleted_at IS NULL
      `;

      if (!supplier) {
        return reply.status(400).send({ error: 'Supplier not found' });
      }

      // Create purchase order
      const poData = withCreateAudit({
        po_number: data.po_number,
        supplier_id: data.supplier_id,
        status: data.status,
        order_date: data.order_date,
        expected_delivery_date: data.expected_delivery_date,
        total_amount: data.total_amount,
        currency: data.currency,
        notes: data.notes,
      }, user.id);

      const [newPO] = await sql`
        INSERT INTO purchase_orders (
          id, po_number, supplier_id, status, order_date, expected_delivery_date,
          total_amount, currency, notes, created_at, updated_at, created_by, updated_by
        ) VALUES (
          ${poData.id}, ${poData.po_number}, ${poData.supplier_id}, ${poData.status},
          ${poData.order_date}, ${poData.expected_delivery_date}, ${poData.total_amount},
          ${poData.currency}, ${poData.notes}, ${poData.created_at}, ${poData.updated_at},
          ${poData.created_by}, ${poData.updated_by}
        ) RETURNING id, po_number, status, order_date, expected_delivery_date, 
                   total_amount, currency, notes, created_at, updated_at
      `;

      // Create purchase order items
      const items = [];
      for (const item of data.items) {
        const itemData = withCreateAudit({
          purchase_order_id: newPO.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          notes: item.notes,
        }, user.id);

        const [newItem] = await sql`
          INSERT INTO purchase_order_items (
            id, purchase_order_id, description, quantity, unit_price, total_price, notes,
            created_at, updated_at, created_by, updated_by
          ) VALUES (
            ${itemData.id}, ${itemData.purchase_order_id}, ${itemData.description},
            ${itemData.quantity}, ${itemData.unit_price}, ${itemData.total_price}, ${itemData.notes},
            ${itemData.created_at}, ${itemData.updated_at}, ${itemData.created_by}, ${itemData.updated_by}
          ) RETURNING id, description, quantity, unit_price, total_price, notes
        `;

        items.push(newItem);
      }

      return reply.status(201).send({ 
        purchase_order: { ...newPO, items } 
      });

    } catch (error) {
      fastify.log.error(error, 'Error creating purchase order:');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.issues,
        });
      }

      return reply.status(500).send({ error: 'Failed to create purchase order' });
    }
  });

  // Update purchase order status
  fastify.patch('/:id/status', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'pending', 'approved', 'ordered', 'received', 'cancelled'],
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager']);

      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid purchase order ID format' });
      }

      // Check if purchase order exists
      const [existingPO] = await sql`
        SELECT id, status as current_status FROM purchase_orders WHERE id = ${id} AND deleted_at IS NULL
      `;

      if (!existingPO) {
        return reply.status(404).send({ error: 'Purchase order not found' });
      }

      // Validate status transition (basic rules)
      const validTransitions: Record<string, string[]> = {
        draft: ['pending', 'cancelled'],
        pending: ['approved', 'cancelled'],
        approved: ['ordered', 'cancelled'],
        ordered: ['received', 'cancelled'],
        received: [], // Final state
        cancelled: [], // Final state
      };

      if (!validTransitions[existingPO.current_status].includes(status)) {
        return reply.status(400).send({ 
          error: `Invalid status transition from ${existingPO.current_status} to ${status}` 
        });
      }

      // Update status
      const updateData = withUpdateAudit({ status }, user.id);
      
      await sql`
        UPDATE purchase_orders 
        SET status = ${updateData.status},
            updated_at = ${updateData.updated_at},
            updated_by = ${updateData.updated_by}
        WHERE id = ${id}
      `;

      return { message: `Purchase order status updated to ${status}` };

    } catch (error) {
      fastify.log.error(error, 'Error updating purchase order status:');
      return reply.status(500).send({ error: 'Failed to update purchase order status' });
    }
  });
}