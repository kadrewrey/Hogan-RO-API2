// routes/permissions.ts
// Permission management routes for Fastify

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import sql, { withCreateAudit, withUpdateAudit, withSoftDelete } from '../lib/db';
import { requireAuth, requireRole, isValidUUID } from '../lib/auth';

// Validation schemas
const createPermissionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  resource: z.string().min(1).max(100),
  action: z.enum(['create', 'read', 'update', 'delete', 'execute', 'manage']),
});

const updatePermissionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  resource: z.string().min(1).max(100).optional(),
  action: z.enum(['create', 'read', 'update', 'delete', 'execute', 'manage']).optional(),
});

export async function permissionRoutes(fastify: FastifyInstance) {
  // Get all permissions
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager']);

      const query = request.query as {
        resource?: string;
        action?: string;
        page?: string;
        limit?: string;
      };

      const page = parseInt(query.page || '1');
      const limit = Math.min(parseInt(query.limit || '50'), 100);
      const offset = (page - 1) * limit;

      // Build where conditions
      let whereConditions = sql`WHERE p.deleted_at IS NULL`;
      
      if (query.resource) {
        whereConditions = sql`${whereConditions} AND p.resource ILIKE ${'%' + query.resource + '%'}`;
      }
      
      if (query.action) {
        whereConditions = sql`${whereConditions} AND p.action = ${query.action}`;
      }

      const permissions = await sql`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.resource,
          p.action,
          p.created_at,
          p.updated_at,
          COUNT(rp.role_id) FILTER (WHERE rp.deleted_at IS NULL) as assigned_roles_count
        FROM permissions p
        LEFT JOIN role_permissions rp ON p.id = rp.permission_id
        ${whereConditions}
        GROUP BY p.id, p.name, p.description, p.resource, p.action, p.created_at, p.updated_at
        ORDER BY p.resource, p.action, p.name
        LIMIT ${limit} OFFSET ${offset}
      `;

      // Get total count for pagination
      const [{ count: totalCount }] = await sql`
        SELECT COUNT(*) as count
        FROM permissions p
        ${whereConditions}
      `;

      const totalPages = Math.ceil(parseInt(totalCount) / limit);

      return {
        permissions,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_count: parseInt(totalCount),
          per_page: limit,
        },
      };

    } catch (error) {
      fastify.log.error(error, 'Error fetching permissions:');
      return reply.status(500).send({ error: 'Failed to fetch permissions' });
    }
  });

  // Get permission by ID
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
      requireRole(user, ['admin', 'manager']);

      const { id } = request.params as { id: string };

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid permission ID format' });
      }

      const [permission] = await sql`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.resource,
          p.action,
          p.created_at,
          p.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', r.id,
                'name', r.name,
                'description', r.description
              ) ORDER BY r.name
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'::json
          ) as assigned_roles
        FROM permissions p
        LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.deleted_at IS NULL
        LEFT JOIN roles r ON rp.role_id = r.id AND r.deleted_at IS NULL
        WHERE p.id = ${id} AND p.deleted_at IS NULL
        GROUP BY p.id, p.name, p.description, p.resource, p.action, p.created_at, p.updated_at
      `;

      if (!permission) {
        return reply.status(404).send({ error: 'Permission not found' });
      }

      return { permission };

    } catch (error) {
      fastify.log.error(error, 'Error fetching permission:');
      return reply.status(500).send({ error: 'Failed to fetch permission' });
    }
  });

  // Create new permission
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'resource', 'action'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          resource: { type: 'string', minLength: 1, maxLength: 100 },
          action: {
            type: 'string',
            enum: ['create', 'read', 'update', 'delete', 'execute', 'manage'],
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin']);

      const data = createPermissionSchema.parse(request.body);

      // Check if permission with same name already exists
      const [existingByName] = await sql`
        SELECT id FROM permissions WHERE name = ${data.name} AND deleted_at IS NULL
      `;

      if (existingByName) {
        return reply.status(400).send({ error: 'Permission name already exists' });
      }

      // Check if permission with same resource+action already exists
      const [existingByResourceAction] = await sql`
        SELECT id FROM permissions 
        WHERE resource = ${data.resource} AND action = ${data.action} AND deleted_at IS NULL
      `;

      if (existingByResourceAction) {
        return reply.status(400).send({ 
          error: 'Permission for this resource and action combination already exists' 
        });
      }

      // Create permission
      const permissionData = withCreateAudit({
        name: data.name,
        description: data.description,
        resource: data.resource,
        action: data.action,
      }, user.id);

      const [newPermission] = await sql`
        INSERT INTO permissions (
          id, name, description, resource, action, created_at, updated_at, created_by, updated_by
        ) VALUES (
          ${permissionData.id}, ${permissionData.name}, ${permissionData.description}, 
          ${permissionData.resource}, ${permissionData.action},
          ${permissionData.created_at}, ${permissionData.updated_at}, 
          ${permissionData.created_by}, ${permissionData.updated_by}
        ) RETURNING id, name, description, resource, action, created_at, updated_at
      `;

      return reply.status(201).send({ permission: newPermission });

    } catch (error) {
      fastify.log.error(error, 'Error creating permission:');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.issues,
        });
      }

      return reply.status(500).send({ error: 'Failed to create permission' });
    }
  });

  // Update permission
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
      requireRole(user, ['admin']);

      const { id } = request.params as { id: string };

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid permission ID format' });
      }

      const data = updatePermissionSchema.parse(request.body);

      // Check if permission exists
      const [existingPermission] = await sql`
        SELECT id, name, resource, action FROM permissions WHERE id = ${id} AND deleted_at IS NULL
      `;

      if (!existingPermission) {
        return reply.status(404).send({ error: 'Permission not found' });
      }

      // Check name uniqueness if changing name
      if (data.name && data.name !== existingPermission.name) {
        const [nameExists] = await sql`
          SELECT id FROM permissions WHERE name = ${data.name} AND id != ${id} AND deleted_at IS NULL
        `;
        if (nameExists) {
          return reply.status(400).send({ error: 'Permission name already exists' });
        }
      }

      // Check resource+action uniqueness if changing either
      const newResource = data.resource || existingPermission.resource;
      const newAction = data.action || existingPermission.action;
      
      if ((data.resource && data.resource !== existingPermission.resource) || 
          (data.action && data.action !== existingPermission.action)) {
        const [resourceActionExists] = await sql`
          SELECT id FROM permissions 
          WHERE resource = ${newResource} AND action = ${newAction} AND id != ${id} AND deleted_at IS NULL
        `;
        if (resourceActionExists) {
          return reply.status(400).send({ 
            error: 'Permission for this resource and action combination already exists' 
          });
        }
      }

      // Update permission
      const updateData = withUpdateAudit({
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.resource && { resource: data.resource }),
        ...(data.action && { action: data.action }),
      }, user.id);

      const [updatedPermission] = await sql`
        UPDATE permissions 
        SET name = COALESCE(${updateData.name}, name),
            description = ${updateData.description !== undefined ? updateData.description : null},
            resource = COALESCE(${updateData.resource}, resource),
            action = COALESCE(${updateData.action}, action),
            updated_at = ${updateData.updated_at},
            updated_by = ${updateData.updated_by}
        WHERE id = ${id}
        RETURNING id, name, description, resource, action, created_at, updated_at
      `;

      return { permission: updatedPermission };

    } catch (error) {
      fastify.log.error(error, 'Error updating permission:');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.issues,
        });
      }

      return reply.status(500).send({ error: 'Failed to update permission' });
    }
  });

  // Delete permission (soft delete)
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
      requireRole(user, ['admin']);

      const { id } = request.params as { id: string };

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid permission ID format' });
      }

      // Check if permission exists
      const [existingPermission] = await sql`
        SELECT id FROM permissions WHERE id = ${id} AND deleted_at IS NULL
      `;

      if (!existingPermission) {
        return reply.status(404).send({ error: 'Permission not found' });
      }

      // Check if permission is assigned to any roles
      const [rolesWithPermission] = await sql`
        SELECT COUNT(*) as count FROM role_permissions 
        WHERE permission_id = ${id} AND deleted_at IS NULL
      `;

      if (parseInt(rolesWithPermission.count) > 0) {
        return reply.status(400).send({ 
          error: 'Cannot delete permission that is assigned to roles',
          assigned_roles: parseInt(rolesWithPermission.count)
        });
      }

      // Soft delete permission
      const deleteData = withSoftDelete(user.id);
      
      await sql`
        UPDATE permissions 
        SET deleted_at = ${deleteData.deleted_at},
            updated_at = ${deleteData.updated_at},
            updated_by = ${deleteData.updated_by}
        WHERE id = ${id}
      `;

      return reply.status(204).send();

    } catch (error) {
      fastify.log.error(error, 'Error deleting permission:');
      return reply.status(500).send({ error: 'Failed to delete permission' });
    }
  });

  // Get available resources (distinct resources from permissions)
  fastify.get('/resources/list', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager']);

      const resources = await sql`
        SELECT DISTINCT resource, COUNT(*) as permission_count
        FROM permissions 
        WHERE deleted_at IS NULL
        GROUP BY resource
        ORDER BY resource
      `;

      return { resources };

    } catch (error) {
      fastify.log.error(error, 'Error fetching resources:');
      return reply.status(500).send({ error: 'Failed to fetch resources' });
    }
  });

  // Get available actions
  fastify.get('/actions/list', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager']);

      const actions = ['create', 'read', 'update', 'delete', 'execute', 'manage'];

      return { actions };

    } catch (error) {
      fastify.log.error(error, 'Error fetching actions:');
      return reply.status(500).send({ error: 'Failed to fetch actions' });
    }
  });
}