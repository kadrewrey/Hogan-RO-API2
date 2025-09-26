// routes/admin.ts
// Admin routes for Fastify

import { FastifyInstance } from 'fastify';

export async function adminRoutes(fastify: FastifyInstance) {
  // Placeholder - will be implemented
  fastify.get('/', async () => {
    return { message: 'Admin routes - coming soon' };
  });
}