import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from '../api/index'

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port })
console.log(`Test server running at http://localhost:${port}`)
