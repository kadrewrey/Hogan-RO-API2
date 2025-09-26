// routes/exports.ts
// Export management routes for Fastify

import { FastifyInstance } from 'fastify';

export async function exportRoutes(fastify: FastifyInstance) {
  // Placeholder - will be implemented
  fastify.get('/', async () => {
    return { message: 'Export routes - coming soon' };
  });
}