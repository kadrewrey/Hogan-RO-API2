// routes/users.ts
// User management routes for Fastify

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import sql, { withCreateAudit, withUpdateAudit, withSoftDelete, getPaginationParams, formatPaginationResponse } from '../lib/db';
import { requireAuth, requireRole, hashPassword, isValidUUID } from '../lib/auth';

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.enum(['basic', 'manager', 'admin']).default('basic'),
  division_id: z.string().uuid().optional(),
  spending_limit_cents: z.number().int().min(0).default(0),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  name: z.string().optional(),
  role: z.enum(['basic', 'manager', 'admin']).optional(),
  division_id: z.string().uuid().optional(),
  spending_limit_cents: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

const querySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  role: z.enum(['basic', 'manager', 'admin']).optional(),
  division_id: z.string().uuid().optional(),
  search: z.string().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // Get all users with pagination and filtering
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          limit: { type: 'string' },
          role: { type: 'string', enum: ['basic', 'manager', 'admin'] },
          division_id: { type: 'string', format: 'uuid' },
          search: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager']);

      const query = querySchema.parse(request.query);
      const { page, limit, offset } = getPaginationParams({ page: query.page, limit: query.limit });

      // Build dynamic query based on filters
      let users, countResult;

      if (query.role && query.division_id && query.search) {
        const searchPattern = `%${query.search}%`;
        users = await sql`
          SELECT 
            u.id, u.email, u.name, u.role, u.division_id, u.spending_limit_cents, 
            u.is_active, u.created_at, u.updated_at,
            d.name as division_name
          FROM users u
          LEFT JOIN divisions d ON u.division_id = d.id AND d.deleted_at IS NULL
          WHERE u.deleted_at IS NULL 
            AND u.role = ${query.role}
            AND u.division_id = ${query.division_id}
            AND (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern})
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        countResult = await sql`
          SELECT COUNT(*) as count FROM users u
          WHERE u.deleted_at IS NULL 
            AND u.role = ${query.role}
            AND u.division_id = ${query.division_id}
            AND (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern})
        `;
      } else if (query.role && query.division_id) {
        users = await sql`
          SELECT 
            u.id, u.email, u.name, u.role, u.division_id, u.spending_limit_cents, 
            u.is_active, u.created_at, u.updated_at,
            d.name as division_name
          FROM users u
          LEFT JOIN divisions d ON u.division_id = d.id AND d.deleted_at IS NULL
          WHERE u.deleted_at IS NULL AND u.role = ${query.role} AND u.division_id = ${query.division_id}
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        countResult = await sql`
          SELECT COUNT(*) as count FROM users u
          WHERE u.deleted_at IS NULL AND u.role = ${query.role} AND u.division_id = ${query.division_id}
        `;
      } else if (query.role && query.search) {
        const searchPattern = `%${query.search}%`;
        users = await sql`
          SELECT 
            u.id, u.email, u.name, u.role, u.division_id, u.spending_limit_cents, 
            u.is_active, u.created_at, u.updated_at,
            d.name as division_name
          FROM users u
          LEFT JOIN divisions d ON u.division_id = d.id AND d.deleted_at IS NULL
          WHERE u.deleted_at IS NULL 
            AND u.role = ${query.role}
            AND (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern})
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        countResult = await sql`
          SELECT COUNT(*) as count FROM users u
          WHERE u.deleted_at IS NULL 
            AND u.role = ${query.role}
            AND (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern})
        `;
      } else if (query.division_id && query.search) {
        const searchPattern = `%${query.search}%`;
        users = await sql`
          SELECT 
            u.id, u.email, u.name, u.role, u.division_id, u.spending_limit_cents, 
            u.is_active, u.created_at, u.updated_at,
            d.name as division_name
          FROM users u
          LEFT JOIN divisions d ON u.division_id = d.id AND d.deleted_at IS NULL
          WHERE u.deleted_at IS NULL 
            AND u.division_id = ${query.division_id}
            AND (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern})
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        countResult = await sql`
          SELECT COUNT(*) as count FROM users u
          WHERE u.deleted_at IS NULL 
            AND u.division_id = ${query.division_id}
            AND (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern})
        `;
      } else if (query.role) {
        users = await sql`
          SELECT 
            u.id, u.email, u.name, u.role, u.division_id, u.spending_limit_cents, 
            u.is_active, u.created_at, u.updated_at,
            d.name as division_name
          FROM users u
          LEFT JOIN divisions d ON u.division_id = d.id AND d.deleted_at IS NULL
          WHERE u.deleted_at IS NULL AND u.role = ${query.role}
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        countResult = await sql`
          SELECT COUNT(*) as count FROM users u WHERE u.deleted_at IS NULL AND u.role = ${query.role}
        `;
      } else if (query.division_id) {
        users = await sql`
          SELECT 
            u.id, u.email, u.name, u.role, u.division_id, u.spending_limit_cents, 
            u.is_active, u.created_at, u.updated_at,
            d.name as division_name
          FROM users u
          LEFT JOIN divisions d ON u.division_id = d.id AND d.deleted_at IS NULL
          WHERE u.deleted_at IS NULL AND u.division_id = ${query.division_id}
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        countResult = await sql`
          SELECT COUNT(*) as count FROM users u WHERE u.deleted_at IS NULL AND u.division_id = ${query.division_id}
        `;
      } else if (query.search) {
        const searchPattern = `%${query.search}%`;
        users = await sql`
          SELECT 
            u.id, u.email, u.name, u.role, u.division_id, u.spending_limit_cents, 
            u.is_active, u.created_at, u.updated_at,
            d.name as division_name
          FROM users u
          LEFT JOIN divisions d ON u.division_id = d.id AND d.deleted_at IS NULL
          WHERE u.deleted_at IS NULL AND (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern})
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        countResult = await sql`
          SELECT COUNT(*) as count FROM users u
          WHERE u.deleted_at IS NULL AND (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern})
        `;
      } else {
        users = await sql`
          SELECT 
            u.id, u.email, u.name, u.role, u.division_id, u.spending_limit_cents, 
            u.is_active, u.created_at, u.updated_at,
            d.name as division_name
          FROM users u
          LEFT JOIN divisions d ON u.division_id = d.id AND d.deleted_at IS NULL
          WHERE u.deleted_at IS NULL
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        countResult = await sql`
          SELECT COUNT(*) as count FROM users u WHERE u.deleted_at IS NULL
        `;
      }

      const [{ count }] = countResult;

      return formatPaginationResponse(users, parseInt(count), page, limit);

    } catch (error) {
      fastify.log.error(error, 'Error fetching users:');
      return reply.status(500).send({ error: 'Failed to fetch users' });
    }
  });

  // Get user by ID
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
      const { id } = request.params as { id: string };

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid user ID format' });
      }

      // Users can view their own profile, managers can view users in their division, admins can view all
      if (user.role !== 'admin' && user.id !== id) {
        if (user.role !== 'manager') {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }

      const [targetUser] = await sql`
        SELECT 
          u.id, u.email, u.name, u.role, u.division_id, u.spending_limit_cents,
          u.is_active, u.created_at, u.updated_at,
          d.name as division_name
        FROM users u
        LEFT JOIN divisions d ON u.division_id = d.id AND d.deleted_at IS NULL
        WHERE u.id = ${id} AND u.deleted_at IS NULL
      `;

      if (!targetUser) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Additional role check for managers
      if (user.role === 'manager' && user.id !== id) {
        if (targetUser.division_id !== user.division_id) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }

      return { user: targetUser };

    } catch (error) {
      fastify.log.error(error, 'Error fetching user:');
      return reply.status(500).send({ error: 'Failed to fetch user' });
    }
  });

  // Create new user
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string' },
          role: { type: 'string', enum: ['basic', 'manager', 'admin'] },
          division_id: { type: 'string', format: 'uuid' },
          spending_limit_cents: { type: 'integer', minimum: 0 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = requireAuth(request);
      requireRole(user, ['admin', 'manager']);

      const data = createUserSchema.parse(request.body);

      // Check if user already exists
      const [existingUser] = await sql`
        SELECT id FROM users WHERE email = ${data.email} AND deleted_at IS NULL
      `;

      if (existingUser) {
        return reply.status(400).send({ error: 'User with this email already exists' });
      }

      // Validate division if provided
      if (data.division_id) {
        const [division] = await sql`
          SELECT id FROM divisions WHERE id = ${data.division_id} AND deleted_at IS NULL
        `;
        if (!division) {
          return reply.status(400).send({ error: 'Division not found' });
        }
      }

      // Hash password
      const hashedPassword = await hashPassword(data.password);

      // Create user
      const userData = withCreateAudit({
        email: data.email,
        password_hash: hashedPassword,
        name: data.name,
        role: data.role,
        division_id: data.division_id,
        spending_limit_cents: data.spending_limit_cents,
        is_active: true,
      }, user.id);

      const [newUser] = await sql`
        INSERT INTO users (
          id, email, password_hash, name, role, division_id, spending_limit_cents,
          is_active, created_at, updated_at, created_by, updated_by
        ) VALUES (
          ${userData.id}, ${userData.email}, ${userData.password_hash}, ${userData.name},
          ${userData.role}, ${userData.division_id}, ${userData.spending_limit_cents},
          ${userData.is_active}, ${userData.created_at}, ${userData.updated_at},
          ${userData.created_by}, ${userData.updated_by}
        ) RETURNING id, email, name, role, division_id, spending_limit_cents, is_active, created_at
      `;

      return reply.status(201).send({ user: newUser });

    } catch (error) {
      fastify.log.error(error, 'Error creating user:');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.issues,
        });
      }

      return reply.status(500).send({ error: 'Failed to create user' });
    }
  });

  // Update user
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
      const { id } = request.params as { id: string };

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid user ID format' });
      }

      // Check permissions
      if (user.role !== 'admin' && user.id !== id) {
        if (user.role !== 'manager') {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }

      const data = updateUserSchema.parse(request.body);

      // Check if target user exists
      const [targetUser] = await sql`
        SELECT id, email, division_id FROM users WHERE id = ${id} AND deleted_at IS NULL
      `;

      if (!targetUser) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Manager role check
      if (user.role === 'manager' && user.id !== id) {
        if (targetUser.division_id !== user.division_id) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }

      // Check email uniqueness if changing email
      if (data.email && data.email !== targetUser.email) {
        const [existingUser] = await sql`
          SELECT id FROM users WHERE email = ${data.email} AND id != ${id} AND deleted_at IS NULL
        `;
        if (existingUser) {
          return reply.status(400).send({ error: 'Email already in use' });
        }
      }

      // Hash password if provided
      let updateData: any = { ...data };
      if (data.password) {
        updateData.password_hash = await hashPassword(data.password);
        delete updateData.password;
      }

      const userData = withUpdateAudit(updateData, user.id);

      // Update specific fields based on what's provided
      let updatedUser;
      if (userData.email && userData.name && userData.role) {
        [updatedUser] = await sql`
          UPDATE users 
          SET email = ${userData.email}, name = ${userData.name}, role = ${userData.role},
              division_id = ${userData.division_id}, spending_limit_cents = ${userData.spending_limit_cents},
              is_active = ${userData.is_active}, updated_at = ${userData.updated_at}, updated_by = ${userData.updated_by}
          WHERE id = ${id}
          RETURNING id, email, name, role, division_id, spending_limit_cents, is_active, updated_at
        `;
      } else if (userData.password_hash) {
        [updatedUser] = await sql`
          UPDATE users 
          SET password_hash = ${userData.password_hash}, updated_at = ${userData.updated_at}, updated_by = ${userData.updated_by}
          WHERE id = ${id}
          RETURNING id, email, name, role, division_id, spending_limit_cents, is_active, updated_at
        `;
      } else {
        // Update available fields
        [updatedUser] = await sql`
          UPDATE users 
          SET name = COALESCE(${userData.name}, name),
              email = COALESCE(${userData.email}, email),
              role = COALESCE(${userData.role}, role),
              division_id = ${userData.division_id !== undefined ? userData.division_id : null},
              spending_limit_cents = COALESCE(${userData.spending_limit_cents}, spending_limit_cents),
              is_active = COALESCE(${userData.is_active}, is_active),
              updated_at = ${userData.updated_at},
              updated_by = ${userData.updated_by}
          WHERE id = ${id}
          RETURNING id, email, name, role, division_id, spending_limit_cents, is_active, updated_at
        `;
      }

      return { user: updatedUser };

    } catch (error) {
      fastify.log.error(error, 'Error updating user:');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.issues,
        });
      }

      return reply.status(500).send({ error: 'Failed to update user' });
    }
  });

  // Delete user (soft delete)
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
        return reply.status(400).send({ error: 'Invalid user ID format' });
      }

      // Check if user exists
      const [targetUser] = await sql`
        SELECT id FROM users WHERE id = ${id} AND deleted_at IS NULL
      `;

      if (!targetUser) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Soft delete
      const deleteData = withSoftDelete(user.id);
      
      await sql`
        UPDATE users 
        SET deleted_at = ${deleteData.deleted_at}, 
            updated_at = ${deleteData.updated_at},
            updated_by = ${deleteData.updated_by}
        WHERE id = ${id}
      `;

      return reply.status(204).send();

    } catch (error) {
      fastify.log.error(error, 'Error deleting user:');
      return reply.status(500).send({ error: 'Failed to delete user' });
    }
  });
}