// routes/suppliers.ts
// Supplier management routes for Fastify

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import sql, { withCreateAudit, withUpdateAudit, withSoftDelete } from '../lib/db';
import { requireAuth, requireRole, isValidUUID } from '../lib/auth';

// Validation schemas
const createSupplierSchema = z.object({
  name: z.string().min(1).max(255),
  contact_name: z.string().min(1).max(255).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().max(50).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip_code: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  tax_id: z.string().max(50).optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

const updateSupplierSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contact_name: z.string().min(1).max(255).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().max(50).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip_code: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  tax_id: z.string().max(50).optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().optional(),
});

export async function supplierRoutes(fastify: FastifyInstance) {
  // Get all suppliers
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager', 'user']);

      const query = request.query as {
        active?: string;
        search?: string;
        city?: string;
        state?: string;
        country?: string;
        page?: string;
        limit?: string;
      };

      const page = parseInt(query.page || '1');
      const limit = Math.min(parseInt(query.limit || '50'), 100);
      const offset = (page - 1) * limit;

      let whereConditions = sql`WHERE s.deleted_at IS NULL`;
      
      if (query.active !== undefined) {
        const isActive = query.active === 'true';
        whereConditions = sql`${whereConditions} AND s.is_active = ${isActive}`;
      }
      
      if (query.search) {
        whereConditions = sql`${whereConditions} AND (
          s.name ILIKE ${'%' + query.search + '%'} OR
          s.contact_name ILIKE ${'%' + query.search + '%'} OR
          s.contact_email ILIKE ${'%' + query.search + '%'} OR
          s.notes ILIKE ${'%' + query.search + '%'}
        )`;
      }
      
      if (query.city) {
        whereConditions = sql`${whereConditions} AND s.city ILIKE ${'%' + query.city + '%'}`;
      }
      
      if (query.state) {
        whereConditions = sql`${whereConditions} AND s.state ILIKE ${'%' + query.state + '%'}`;
      }
      
      if (query.country) {
        whereConditions = sql`${whereConditions} AND s.country ILIKE ${'%' + query.country + '%'}`;
      }

      const suppliers = await sql`
        SELECT 
          s.id,
          s.name,
          s.contact_name,
          s.contact_email,
          s.contact_phone,
          s.address,
          s.city,
          s.state,
          s.zip_code,
          s.country,
          s.tax_id,
          s.payment_terms,
          s.notes,
          s.is_active,
          s.created_at,
          s.updated_at,
          COUNT(po.id) as purchase_order_count,
          COALESCE(SUM(po.total_amount), 0) as total_purchase_amount
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.deleted_at IS NULL
        ${whereConditions}
        GROUP BY s.id, s.name, s.contact_name, s.contact_email, s.contact_phone, 
                 s.address, s.city, s.state, s.zip_code, s.country, s.tax_id, 
                 s.payment_terms, s.notes, s.is_active, s.created_at, s.updated_at
        ORDER BY s.name
        LIMIT ${limit} OFFSET ${offset}
      `;

      // Get total count for pagination
      const [{ count: totalCount }] = await sql`
        SELECT COUNT(*) as count
        FROM suppliers s
        ${whereConditions}
      `;

      const totalPages = Math.ceil(parseInt(totalCount) / limit);

      return {
        suppliers,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_count: parseInt(totalCount),
          per_page: limit,
        },
      };

    } catch (error) {
      fastify.log.error(error, 'Error fetching suppliers:');
      return reply.status(500).send({ error: 'Failed to fetch suppliers' });
    }
  });

  // Get supplier by ID
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
        return reply.status(400).send({ error: 'Invalid supplier ID format' });
      }

      const [supplier] = await sql`
        SELECT 
          s.id,
          s.name,
          s.contact_name,
          s.contact_email,
          s.contact_phone,
          s.address,
          s.city,
          s.state,
          s.zip_code,
          s.country,
          s.tax_id,
          s.payment_terms,
          s.notes,
          s.is_active,
          s.created_at,
          s.updated_at,
          COUNT(po.id) as purchase_order_count,
          COALESCE(SUM(po.total_amount), 0) as total_purchase_amount,
          COALESCE(
            json_agg(
              json_build_object(
                'id', po.id,
                'po_number', po.po_number,
                'status', po.status,
                'order_date', po.order_date,
                'total_amount', po.total_amount,
                'currency', po.currency
              ) ORDER BY po.order_date DESC
            ) FILTER (WHERE po.id IS NOT NULL),
            '[]'::json
          ) as recent_purchase_orders
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.deleted_at IS NULL
        WHERE s.id = ${id} AND s.deleted_at IS NULL
        GROUP BY s.id, s.name, s.contact_name, s.contact_email, s.contact_phone, 
                 s.address, s.city, s.state, s.zip_code, s.country, s.tax_id, 
                 s.payment_terms, s.notes, s.is_active, s.created_at, s.updated_at
      `;

      if (!supplier) {
        return reply.status(404).send({ error: 'Supplier not found' });
      }

      return { supplier };

    } catch (error) {
      fastify.log.error(error, 'Error fetching supplier:');
      return reply.status(500).send({ error: 'Failed to fetch supplier' });
    }
  });

  // Create new supplier
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          contact_name: { type: 'string', minLength: 1, maxLength: 255 },
          contact_email: { type: 'string', format: 'email' },
          contact_phone: { type: 'string', maxLength: 50 },
          address: { type: 'string' },
          city: { type: 'string', maxLength: 100 },
          state: { type: 'string', maxLength: 100 },
          zip_code: { type: 'string', maxLength: 20 },
          country: { type: 'string', maxLength: 100 },
          tax_id: { type: 'string', maxLength: 50 },
          payment_terms: { type: 'string' },
          notes: { type: 'string' },
          is_active: { type: 'boolean' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager']);

      const data = createSupplierSchema.parse(request.body);

      // Check if supplier name already exists
      const [existingSupplier] = await sql`
        SELECT id FROM suppliers WHERE name = ${data.name} AND deleted_at IS NULL
      `;

      if (existingSupplier) {
        return reply.status(400).send({ error: 'Supplier name already exists' });
      }

      // Create supplier
      const supplierData = withCreateAudit({
        name: data.name,
        contact_name: data.contact_name,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
        country: data.country,
        tax_id: data.tax_id,
        payment_terms: data.payment_terms,
        notes: data.notes,
        is_active: data.is_active,
      }, user.id);

      const [newSupplier] = await sql`
        INSERT INTO suppliers (
          id, name, contact_name, contact_email, contact_phone, address, city, state,
          zip_code, country, tax_id, payment_terms, notes, is_active,
          created_at, updated_at, created_by, updated_by
        ) VALUES (
          ${supplierData.id}, ${supplierData.name}, ${supplierData.contact_name}, 
          ${supplierData.contact_email}, ${supplierData.contact_phone}, ${supplierData.address},
          ${supplierData.city}, ${supplierData.state}, ${supplierData.zip_code}, 
          ${supplierData.country}, ${supplierData.tax_id}, ${supplierData.payment_terms},
          ${supplierData.notes}, ${supplierData.is_active}, ${supplierData.created_at}, 
          ${supplierData.updated_at}, ${supplierData.created_by}, ${supplierData.updated_by}
        ) RETURNING id, name, contact_name, contact_email, contact_phone, address, city, 
                   state, zip_code, country, tax_id, payment_terms, notes, is_active,
                   created_at, updated_at
      `;

      return reply.status(201).send({ supplier: newSupplier });

    } catch (error) {
      fastify.log.error(error, 'Error creating supplier:');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.issues,
        });
      }

      return reply.status(500).send({ error: 'Failed to create supplier' });
    }
  });

  // Update supplier
  fastify.put('/:id', {
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
      requireRole(user, ['admin', 'manager']);

      const { id } = request.params as { id: string };

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid supplier ID format' });
      }

      const data = updateSupplierSchema.parse(request.body);

      // Check if supplier exists
      const [existingSupplier] = await sql`
        SELECT id, name FROM suppliers WHERE id = ${id} AND deleted_at IS NULL
      `;

      if (!existingSupplier) {
        return reply.status(404).send({ error: 'Supplier not found' });
      }

      // Check name uniqueness if changing name
      if (data.name && data.name !== existingSupplier.name) {
        const [nameExists] = await sql`
          SELECT id FROM suppliers WHERE name = ${data.name} AND id != ${id} AND deleted_at IS NULL
        `;
        if (nameExists) {
          return reply.status(400).send({ error: 'Supplier name already exists' });
        }
      }

      // Update supplier
      const updateData = withUpdateAudit({
        ...(data.name && { name: data.name }),
        ...(data.contact_name !== undefined && { contact_name: data.contact_name }),
        ...(data.contact_email !== undefined && { contact_email: data.contact_email }),
        ...(data.contact_phone !== undefined && { contact_phone: data.contact_phone }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.zip_code !== undefined && { zip_code: data.zip_code }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.tax_id !== undefined && { tax_id: data.tax_id }),
        ...(data.payment_terms !== undefined && { payment_terms: data.payment_terms }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      }, user.id);

      const [updatedSupplier] = await sql`
        UPDATE suppliers 
        SET name = COALESCE(${updateData.name}, name),
            contact_name = ${updateData.contact_name !== undefined ? updateData.contact_name : null},
            contact_email = ${updateData.contact_email !== undefined ? updateData.contact_email : null},
            contact_phone = ${updateData.contact_phone !== undefined ? updateData.contact_phone : null},
            address = ${updateData.address !== undefined ? updateData.address : null},
            city = ${updateData.city !== undefined ? updateData.city : null},
            state = ${updateData.state !== undefined ? updateData.state : null},
            zip_code = ${updateData.zip_code !== undefined ? updateData.zip_code : null},
            country = ${updateData.country !== undefined ? updateData.country : null},
            tax_id = ${updateData.tax_id !== undefined ? updateData.tax_id : null},
            payment_terms = ${updateData.payment_terms !== undefined ? updateData.payment_terms : null},
            notes = ${updateData.notes !== undefined ? updateData.notes : null},
            is_active = COALESCE(${updateData.is_active}, is_active),
            updated_at = ${updateData.updated_at},
            updated_by = ${updateData.updated_by}
        WHERE id = ${id}
        RETURNING id, name, contact_name, contact_email, contact_phone, address, city, 
                  state, zip_code, country, tax_id, payment_terms, notes, is_active,
                  created_at, updated_at
      `;

      return { supplier: updatedSupplier };

    } catch (error) {
      fastify.log.error(error, 'Error updating supplier:');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.issues,
        });
      }

      return reply.status(500).send({ error: 'Failed to update supplier' });
    }
  });

  // Delete supplier (soft delete)
  fastify.delete('/:id', {
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
      requireRole(user, ['admin', 'manager']);

      const { id } = request.params as { id: string };

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid supplier ID format' });
      }

      // Check if supplier exists
      const [existingSupplier] = await sql`
        SELECT id FROM suppliers WHERE id = ${id} AND deleted_at IS NULL
      `;

      if (!existingSupplier) {
        return reply.status(404).send({ error: 'Supplier not found' });
      }

      // Check if supplier has active purchase orders
      const [activePO] = await sql`
        SELECT COUNT(*) as count FROM purchase_orders 
        WHERE supplier_id = ${id} AND status IN ('pending', 'approved', 'ordered') AND deleted_at IS NULL
      `;

      if (parseInt(activePO.count) > 0) {
        return reply.status(400).send({ 
          error: 'Cannot delete supplier with active purchase orders',
          active_purchase_orders: parseInt(activePO.count)
        });
      }

      // Soft delete supplier
      const deleteData = withSoftDelete(user.id);
      
      await sql`
        UPDATE suppliers 
        SET deleted_at = ${deleteData.deleted_at},
            updated_at = ${deleteData.updated_at},
            updated_by = ${deleteData.updated_by}
        WHERE id = ${id}
      `;

      return reply.status(204).send();

    } catch (error) {
      fastify.log.error(error, 'Error deleting supplier:');
      return reply.status(500).send({ error: 'Failed to delete supplier' });
    }
  });

  // Toggle supplier active status
  fastify.patch('/:id/toggle-active', {
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
      requireRole(user, ['admin', 'manager']);

      const { id } = request.params as { id: string };

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid supplier ID format' });
      }

      // Check if supplier exists and get current status
      const [existingSupplier] = await sql`
        SELECT id, name, is_active FROM suppliers WHERE id = ${id} AND deleted_at IS NULL
      `;

      if (!existingSupplier) {
        return reply.status(404).send({ error: 'Supplier not found' });
      }

      const newActiveStatus = !existingSupplier.is_active;

      // Update active status
      const updateData = withUpdateAudit({ is_active: newActiveStatus }, user.id);
      
      await sql`
        UPDATE suppliers 
        SET is_active = ${updateData.is_active},
            updated_at = ${updateData.updated_at},
            updated_by = ${updateData.updated_by}
        WHERE id = ${id}
      `;

      return { 
        message: `Supplier ${newActiveStatus ? 'activated' : 'deactivated'} successfully`,
        is_active: newActiveStatus 
      };

    } catch (error) {
      fastify.log.error(error, 'Error toggling supplier status:');
      return reply.status(500).send({ error: 'Failed to toggle supplier status' });
    }
  });
}