// lib/db.ts
// Database connection and utility functions for Fastify

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create the database connection
const sql = neon(process.env.DATABASE_URL);

export default sql;

// Utility function to generate UUIDs
export function generateUUID(): string {
  return crypto.randomUUID();
}

// Utility function to check if a string is a valid UUID
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Audit trail helpers
export function withCreateAudit<T extends Record<string, any>>(
  data: T,
  userId?: string
): T & {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
} {
  const now = new Date().toISOString();
  const id = generateUUID();
  const user_id = userId || 'system';
  
  return {
    ...data,
    id,
    created_at: now,
    updated_at: now,
    created_by: user_id,
    updated_by: user_id,
  };
}

export function withUpdateAudit<T extends Record<string, any>>(
  data: T,
  userId?: string
): T & {
  updated_at: string;
  updated_by: string;
} {
  const now = new Date().toISOString();
  const user_id = userId || 'system';
  
  return {
    ...data,
    updated_at: now,
    updated_by: user_id,
  };
}

// Soft delete helper
export function withSoftDelete(userId?: string) {
  const now = new Date().toISOString();
  const user_id = userId || 'system';
  
  return {
    deleted_at: now,
    updated_at: now,
    updated_by: user_id,
  };
}

// Pagination helper
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export function getPaginationParams(options: PaginationOptions = {}) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

export function formatPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Transaction helper (for complex operations)
export async function withTransaction<T>(
  operation: () => Promise<T>
): Promise<T> {
  // Note: Neon doesn't support traditional transactions in the same way
  // For now, we'll just execute the operation
  // In production, you might want to use a different approach or pg library
  return await operation();
}