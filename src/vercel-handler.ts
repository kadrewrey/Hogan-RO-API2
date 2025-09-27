import { build } from './app'
import type { VercelRequest, VercelResponse } from '@vercel/node'

let app: any = null

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!app) {
    app = await build()
    await app.ready()
  }
  
  return app.server(req, res)
}