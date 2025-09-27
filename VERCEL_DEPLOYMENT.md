# Vercel Deployment Guide

## Overview
This project is now configured for deployment on Vercel with a serverless architecture.

## Files Added/Modified for Vercel

1. **`vercel.json`** - Vercel configuration file
2. **`src/app.ts`** - Shared Fastify app builder
3. **`src/vercel-handler.ts`** - Vercel serverless handler
4. **`src/server.ts`** - Updated for local development

## Deployment Steps

### 1. Prerequisites
- Vercel CLI installed: `npm i -g vercel`
- Vercel account connected: `vercel login`

### 2. Environment Variables
Set these environment variables in your Vercel dashboard:

```bash
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_production_jwt_secret
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
LOG_LEVEL=info
```

### 3. Deploy
```bash
# Build first
npm run build

# Deploy to Vercel
vercel

# Or deploy to production
vercel --prod
```

### 4. Update CORS Origins
Once deployed, update your `CORS_ORIGIN` environment variable to include your Vercel domain:
```
CORS_ORIGIN=https://your-frontend-domain.com,https://your-api-domain.vercel.app
```

## Project Structure

```
src/
├── app.ts              # Shared Fastify app configuration
├── server.ts           # Local development server
├── vercel-handler.ts   # Vercel serverless entry point
├── routes/             # API route handlers
└── lib/                # Utilities and middleware

dist/                   # Compiled JavaScript (auto-generated)
vercel.json            # Vercel deployment configuration
```

## Local Development

```bash
npm run dev    # Start development server
npm run build  # Build for production
npm start      # Start production build locally
```

## API Endpoints

- Health Check: `GET /health`
- API Documentation: `GET /docs`
- All API routes: `/api/v1/*`

## Notes

- The app automatically detects Vercel environment (`process.env.VERCEL`)
- Uses serverless functions with 30-second timeout
- Swagger UI available at `/docs` in both environments
- Database connections are handled by Neon serverless