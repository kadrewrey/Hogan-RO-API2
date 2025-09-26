// lib/auth.ts
// Authentication and authorization utilities for Fastify

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { FastifyRequest } from 'fastify';
import sql from './db';
import { AuthenticatedUser } from './types';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// JWT token utilities
export function generateToken(user: AuthenticatedUser): string {
  const payload = {
    sub: user.sub,
    id: user.id,
    email: user.email,
    role: user.role,
    division_id: user.division_id,
  };
  
  // Cast to avoid TypeScript issues with JWT library
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any);
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// UUID validation
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Extract and verify user from request
export function extractUserFromRequest(request: FastifyRequest): AuthenticatedUser | null {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return null;
  }

  return {
    id: decoded.id,
    sub: decoded.sub,
    email: decoded.email,
    name: decoded.name,
    role: decoded.role,
    division_id: decoded.division_id,
    spending_limit_cents: decoded.spending_limit_cents || 0,
  };
}

// Authentication middleware for Fastify
export function requireAuth(request: FastifyRequest): AuthenticatedUser {
  const user = extractUserFromRequest(request);
  
  if (!user) {
    throw new Error('Unauthorized: Valid JWT token required');
  }
  
  return user;
}

// Role-based authorization
export function requireRole(user: AuthenticatedUser, allowedRoles: string[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Forbidden: Requires one of roles: ${allowedRoles.join(', ')}`);
  }
}

// Permission-based authorization helpers
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const permissions = await sql`
      SELECT DISTINCT p.name
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.id = ${userId}
        AND u.deleted_at IS NULL
        AND ur.deleted_at IS NULL
        AND rp.deleted_at IS NULL
        AND p.deleted_at IS NULL
    `;
    
    return permissions.map((p: any) => p.name);
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
}

export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permission);
}

export async function requirePermission(userId: string, permission: string): Promise<void> {
  const hasRequired = await hasPermission(userId, permission);
  if (!hasRequired) {
    throw new Error(`Forbidden: Missing required permission: ${permission}`);
  }
}

// User management authorization helpers
export function canManageUsers(user: AuthenticatedUser): boolean {
  return ['admin', 'manager'].includes(user.role);
}

export function canManageRoles(user: AuthenticatedUser): boolean {
  return user.role === 'admin';
}

// Division-based authorization
export function canAccessDivision(user: AuthenticatedUser, divisionId: string): boolean {
  // Admins can access all divisions
  if (user.role === 'admin') {
    return true;
  }
  
  // Users can only access their own division
  return user.division_id === divisionId;
}

// Spending limit authorization
export function canCreatePurchaseOrder(user: AuthenticatedUser, totalCents: number): boolean {
  // Admins have no spending limits
  if (user.role === 'admin') {
    return true;
  }
  
  // Check spending limit for other roles
  return totalCents <= user.spending_limit_cents;
}

// Get authenticated user with database lookup
export async function getAuthenticatedUser(request: FastifyRequest): Promise<AuthenticatedUser> {
  const tokenUser = requireAuth(request);
  
  // Get fresh user data from database
  const [dbUser] = await sql`
    SELECT id, sub, email, name, role, division_id, spending_limit_cents, is_active
    FROM users 
    WHERE id = ${tokenUser.id} AND deleted_at IS NULL
  `;
  
  if (!dbUser || !dbUser.is_active) {
    throw new Error('Unauthorized: User not found or inactive');
  }
  
  return {
    id: dbUser.id,
    sub: dbUser.sub,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    division_id: dbUser.division_id,
    spending_limit_cents: dbUser.spending_limit_cents,
  };
}

// Error types for better error handling
export class AuthenticationError extends Error {
  statusCode = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  statusCode = 403;
  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// Fastify hook for authentication
export async function authenticateUser(request: FastifyRequest): Promise<void> {
  try {
    const user = extractUserFromRequest(request);
    if (user) {
      // Add user to request context
      (request as any).user = user;
    }
  } catch (error) {
    // Don't throw here - let individual routes decide if auth is required
  }
}