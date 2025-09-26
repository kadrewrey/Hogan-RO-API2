// routes/roles.ts
// Role management routes for Fastify

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import sql, { withCreateAudit, withUpdateAudit, withSoftDelete } from '../lib/db';
import { requireAuth, requireRole, isValidUUID } from '../lib/auth';

// Validation schemas
const createRoleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  is_system_role: z.boolean().default(false),
  permissions: z.array(z.string().uuid()).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string().uuid()).optional(),
});

export async function roleRoutes(fastify: FastifyInstance) {
  // Get all roles with their permissions
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager']);

      const roles = await sql`
        SELECT 
          r.id,
          r.name,
          r.description,
          r.is_system_role,
          r.created_at,
          r.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'resource', p.resource,
                'action', p.action
              ) ORDER BY p.resource, p.action
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'::json
          ) as permissions
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id AND rp.deleted_at IS NULL
        LEFT JOIN permissions p ON rp.permission_id = p.id AND p.deleted_at IS NULL
        WHERE r.deleted_at IS NULL
        GROUP BY r.id, r.name, r.description, r.is_system_role, r.created_at, r.updated_at
        ORDER BY r.name
      `;

      return { roles };

    } catch (error) {
      fastify.log.error(error, 'Error fetching roles:');
      return reply.status(500).send({ error: 'Failed to fetch roles' });
    }
  });

  // Get role by ID
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
        return reply.status(400).send({ error: 'Invalid role ID format' });
      }

      const [role] = await sql`
        SELECT 
          r.id,
          r.name,
          r.description,
          r.is_system_role,
          r.created_at,
          r.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'resource', p.resource,
                'action', p.action
              ) ORDER BY p.resource, p.action
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'::json
          ) as permissions
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id AND rp.deleted_at IS NULL
        LEFT JOIN permissions p ON rp.permission_id = p.id AND p.deleted_at IS NULL
        WHERE r.id = ${id} AND r.deleted_at IS NULL
        GROUP BY r.id, r.name, r.description, r.is_system_role, r.created_at, r.updated_at
      `;

      if (!role) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      return { role };

    } catch (error) {
      fastify.log.error(error, 'Error fetching role:');
      return reply.status(500).send({ error: 'Failed to fetch role' });
    }
  });

  // Create new role
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          is_system_role: { type: 'boolean' },
          permissions: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin']);

      const data = createRoleSchema.parse(request.body);

      // Check if role name already exists
      const [existingRole] = await sql`
        SELECT id FROM roles WHERE name = ${data.name} AND deleted_at IS NULL
      `;

      if (existingRole) {
        return reply.status(400).send({ error: 'Role name already exists' });
      }

      // Validate permissions if provided
      if (data.permissions && data.permissions.length > 0) {
        const validPermissions = await sql`
          SELECT id FROM permissions WHERE id = ANY(${data.permissions}) AND deleted_at IS NULL
        `;

        if (validPermissions.length !== data.permissions.length) {
          return reply.status(400).send({ error: 'One or more permissions are invalid' });
        }
      }

      // Create role
      const roleData = withCreateAudit({
        name: data.name,
        description: data.description,
        is_system_role: data.is_system_role,
      }, user.id);

      const [newRole] = await sql`
        INSERT INTO roles (
          id, name, description, is_system_role, created_at, updated_at, created_by, updated_by
        ) VALUES (
          ${roleData.id}, ${roleData.name}, ${roleData.description}, ${roleData.is_system_role},
          ${roleData.created_at}, ${roleData.updated_at}, ${roleData.created_by}, ${roleData.updated_by}
        ) RETURNING id, name, description, is_system_role, created_at, updated_at
      `;

      // Assign permissions if provided
      if (data.permissions && data.permissions.length > 0) {
        for (const permissionId of data.permissions) {
          const rolePermissionData = withCreateAudit({
            role_id: newRole.id,
            permission_id: permissionId,
          }, user.id);

          await sql`
            INSERT INTO role_permissions (
              id, role_id, permission_id, created_at, updated_at, created_by, updated_by
            ) VALUES (
              ${rolePermissionData.id}, ${rolePermissionData.role_id}, ${rolePermissionData.permission_id},
              ${rolePermissionData.created_at}, ${rolePermissionData.updated_at}, 
              ${rolePermissionData.created_by}, ${rolePermissionData.updated_by}
            )
          `;
        }
      }

      // Fetch complete role with permissions
      const [completeRole] = await sql`
        SELECT 
          r.id,
          r.name,
          r.description,
          r.is_system_role,
          r.created_at,
          r.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'resource', p.resource,
                'action', p.action
              ) ORDER BY p.resource, p.action
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'::json
          ) as permissions
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id AND rp.deleted_at IS NULL
        LEFT JOIN permissions p ON rp.permission_id = p.id AND p.deleted_at IS NULL
        WHERE r.id = ${newRole.id} AND r.deleted_at IS NULL
        GROUP BY r.id, r.name, r.description, r.is_system_role, r.created_at, r.updated_at
      `;

      return reply.status(201).send({ role: completeRole });

    } catch (error) {
      fastify.log.error(error, 'Error creating role:');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.issues,
        });
      }

      return reply.status(500).send({ error: 'Failed to create role' });
    }
  });

  // Update role
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
        return reply.status(400).send({ error: 'Invalid role ID format' });
      }

      const data = updateRoleSchema.parse(request.body);

      // Check if role exists
      const [existingRole] = await sql`
        SELECT id, name, is_system_role FROM roles WHERE id = ${id} AND deleted_at IS NULL
      `;

      if (!existingRole) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Check if trying to modify system role
      if (existingRole.is_system_role && user.role !== 'admin') {
        return reply.status(403).send({ error: 'Cannot modify system roles' });
      }

      // Check name uniqueness if changing name
      if (data.name && data.name !== existingRole.name) {
        const [nameExists] = await sql`
          SELECT id FROM roles WHERE name = ${data.name} AND id != ${id} AND deleted_at IS NULL
        `;
        if (nameExists) {
          return reply.status(400).send({ error: 'Role name already exists' });
        }
      }

      // Update role basic info if provided
      if (data.name || data.description !== undefined) {
        const updateData = withUpdateAudit({
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
        }, user.id);

        await sql`
          UPDATE roles 
          SET name = COALESCE(${updateData.name}, name),
              description = ${updateData.description !== undefined ? updateData.description : null},
              updated_at = ${updateData.updated_at},
              updated_by = ${updateData.updated_by}
          WHERE id = ${id}
        `;
      }

      // Update permissions if provided
      if (data.permissions) {
        // Validate permissions
        if (data.permissions.length > 0) {
          const validPermissions = await sql`
            SELECT id FROM permissions WHERE id = ANY(${data.permissions}) AND deleted_at IS NULL
          `;

          if (validPermissions.length !== data.permissions.length) {
            return reply.status(400).send({ error: 'One or more permissions are invalid' });
          }
        }

        // Remove existing permissions
        const deleteData = withSoftDelete(user.id);
        await sql`
          UPDATE role_permissions 
          SET deleted_at = ${deleteData.deleted_at},
              updated_at = ${deleteData.updated_at},
              updated_by = ${deleteData.updated_by}
          WHERE role_id = ${id}
        `;

        // Add new permissions
        for (const permissionId of data.permissions) {
          const rolePermissionData = withCreateAudit({
            role_id: id,
            permission_id: permissionId,
          }, user.id);

          await sql`
            INSERT INTO role_permissions (
              id, role_id, permission_id, created_at, updated_at, created_by, updated_by
            ) VALUES (
              ${rolePermissionData.id}, ${rolePermissionData.role_id}, ${rolePermissionData.permission_id},
              ${rolePermissionData.created_at}, ${rolePermissionData.updated_at},
              ${rolePermissionData.created_by}, ${rolePermissionData.updated_by}
            )
          `;
        }
      }

      // Fetch updated role with permissions
      const [updatedRole] = await sql`
        SELECT 
          r.id,
          r.name,
          r.description,
          r.is_system_role,
          r.created_at,
          r.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'resource', p.resource,
                'action', p.action
              ) ORDER BY p.resource, p.action
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'::json
          ) as permissions
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id AND rp.deleted_at IS NULL
        LEFT JOIN permissions p ON rp.permission_id = p.id AND p.deleted_at IS NULL
        WHERE r.id = ${id} AND r.deleted_at IS NULL
        GROUP BY r.id, r.name, r.description, r.is_system_role, r.created_at, r.updated_at
      `;

      return { role: updatedRole };

    } catch (error) {
      fastify.log.error(error, 'Error updating role:');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.issues,
        });
      }

      return reply.status(500).send({ error: 'Failed to update role' });
    }
  });

  // Delete role (soft delete)
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
        return reply.status(400).send({ error: 'Invalid role ID format' });
      }

      // Check if role exists
      const [existingRole] = await sql`
        SELECT id, name, is_system_role FROM roles WHERE id = ${id} AND deleted_at IS NULL
      `;

      if (!existingRole) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      // Prevent deletion of system roles
      if (existingRole.is_system_role) {
        return reply.status(400).send({ error: 'Cannot delete system roles' });
      }

      // Check if role is assigned to any users
      const [usersWithRole] = await sql`
        SELECT COUNT(*) as count FROM user_roles 
        WHERE role_id = ${id} AND deleted_at IS NULL
      `;

      if (parseInt(usersWithRole.count) > 0) {
        return reply.status(400).send({ 
          error: 'Cannot delete role that is assigned to users',
          assigned_users: parseInt(usersWithRole.count)
        });
      }

      // Soft delete role
      const deleteData = withSoftDelete(user.id);
      
      await sql`
        UPDATE roles 
        SET deleted_at = ${deleteData.deleted_at},
            updated_at = ${deleteData.updated_at},
            updated_by = ${deleteData.updated_by}
        WHERE id = ${id}
      `;

      // Soft delete role permissions
      await sql`
        UPDATE role_permissions 
        SET deleted_at = ${deleteData.deleted_at},
            updated_at = ${deleteData.updated_at},
            updated_by = ${deleteData.updated_by}
        WHERE role_id = ${id}
      `;

      return reply.status(204).send();

    } catch (error) {
      fastify.log.error(error, 'Error deleting role:');
      return reply.status(500).send({ error: 'Failed to delete role' });
    }
  });
}