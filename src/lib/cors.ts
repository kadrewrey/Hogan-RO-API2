// lib/cors.ts
// CORS configuration for Fastify

export const corsOptions = {
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3001').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
};

// Helper function to check if origin is allowed
export function isOriginAllowed(origin: string): boolean {
  const allowedOrigins = corsOptions.origin;
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

// Manual CORS headers for custom handling (if needed)
export function getCorsHeaders(origin?: string) {
  const allowedOrigin = origin && isOriginAllowed(origin) ? origin : corsOptions.origin[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': corsOptions.methods.join(', '),
    'Access-Control-Allow-Headers': corsOptions.allowedHeaders.join(', '),
    'Access-Control-Allow-Credentials': corsOptions.credentials ? 'true' : 'false',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}