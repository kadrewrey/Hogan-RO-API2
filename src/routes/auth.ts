// routes/auth.ts
// Authentication routes for Fastify

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import sql from '../lib/db';
import { generateToken, hashPassword, comparePassword } from '../lib/auth';
import { AuthenticatedUser } from '../lib/types';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  division_id: z.string().uuid().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Route handlers
export async function authRoutes(fastify: FastifyInstance) {
  // Register endpoint
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string' },
          division_id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
            token: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = registerSchema.parse(request.body);
      
      // Check if user already exists
      const [existingUser] = await sql`
        SELECT id FROM users WHERE email = ${data.email} AND deleted_at IS NULL
      `;
      
      if (existingUser) {
        return reply.status(400).send({
          error: 'User with this email already exists'
        });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(data.password);
      
      // Create user
      const [user] = await sql`
        INSERT INTO users (
          email, 
          password_hash, 
          name, 
          role, 
          division_id, 
          spending_limit_cents,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          ${data.email},
          ${hashedPassword},
          ${data.name || null},
          'basic',
          ${data.division_id || null},
          0,
          true,
          NOW(),
          NOW()
        ) RETURNING id, email, name, role, division_id, spending_limit_cents
      `;
      
      // Create authenticated user object
      const authUser: AuthenticatedUser = {
        id: user.id,
        sub: user.id, // Using user ID as subject for now
        email: user.email,
        name: user.name,
        role: user.role,
        division_id: user.division_id,
        spending_limit_cents: user.spending_limit_cents,
      };
      
      // Generate JWT token
      const token = generateToken(authUser);
      
      return reply.status(201).send({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      });
      
    } catch (error) {
      fastify.log.error(error, 'Registration error:');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.issues,
        });
      }
      
      return reply.status(500).send({
        error: 'Registration failed',
      });
    }
  });

  // Login endpoint
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
            token: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = loginSchema.parse(request.body);
      
      // Find user
      const [user] = await sql`
        SELECT id, email, name, role, division_id, spending_limit_cents, password_hash, is_active
        FROM users 
        WHERE email = ${data.email} AND deleted_at IS NULL
      `;
      
      if (!user) {
        return reply.status(401).send({
          error: 'Invalid credentials'
        });
      }
      
      if (!user.is_active) {
        return reply.status(401).send({
          error: 'Account is disabled'
        });
      }
      
      // Verify password
      const isValidPassword = await comparePassword(data.password, user.password_hash);
      if (!isValidPassword) {
        return reply.status(401).send({
          error: 'Invalid credentials'
        });
      }
      
      // Create authenticated user object
      const authUser: AuthenticatedUser = {
        id: user.id,
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        division_id: user.division_id,
        spending_limit_cents: user.spending_limit_cents,
      };
      
      // Generate JWT token
      const token = generateToken(authUser);
      
      return reply.send({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      });
      
    } catch (error) {
      fastify.log.error(error, 'Login error:');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.issues,
        });
      }
      
      return reply.status(500).send({
        error: 'Login failed',
      });
    }
  });

  // Token verification endpoint
  fastify.get('/verify', {
    schema: {
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' },
        },
        required: ['authorization'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Missing or invalid authorization header'
        });
      }
      
      // This will throw if token is invalid
      const { requireAuth } = await import('../lib/auth');
      const user = requireAuth(request);
      
      return reply.send({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
      
    } catch (error) {
      fastify.log.error(error, 'Token verification error:');
      
      return reply.status(401).send({
        valid: false,
        error: 'Invalid token',
      });
    }
  });
}