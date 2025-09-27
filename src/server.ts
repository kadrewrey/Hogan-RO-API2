import { build } from './app'

// Environment configuration
const PORT = parseInt(process.env.PORT || '3002')
const HOST = process.env.HOST || '0.0.0.0' // Bind to all interfaces for better connectivity

// Start server
async function start() {
  try {
    const fastify = await build()
    
    await fastify.listen({ port: PORT, host: HOST })
    console.log(`🚀 Hogan RO API v2 running on http://${HOST}:${PORT}`)
    console.log(`📚 API Documentation available at http://${HOST}:${PORT}/docs`)
    
    return fastify
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

// Start the server and handle shutdown
let fastifyInstance: any = null

async function main() {
  fastifyInstance = await start()
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...')
  if (fastifyInstance) {
    await fastifyInstance.close()
  }
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  if (fastifyInstance) {
    await fastifyInstance.close()
  }
  process.exit(0)
})

main().catch(console.error)