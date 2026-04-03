/**
 * HTTP transport for the Bifrost MCP server.
 * Enables remote access to Bifrost's infrastructure management capabilities.
 *
 * Usage:
 *   BIFROST_MCP_HTTP=1 BIFROST_MCP_PORT=3100 npx tsx src/mcp/index.ts
 *   BIFROST_MCP_TOKEN=mysecret BIFROST_MCP_HTTP=1 npx tsx src/mcp/index.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { randomUUID } from 'crypto'

export interface HttpTransportOptions {
  port: number
  host: string
  token?: string
}

export function createHttpTransport(options: HttpTransportOptions): {
  transport: StreamableHTTPServerTransport
  start: () => Promise<void>
} {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID()
  })

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id')
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Health check endpoint (public, before auth)
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', server: 'bifrost-mcp' }))
      return
    }

    // Token authentication (if configured)
    if (options.token) {
      const auth = req.headers['authorization']
      if (!auth || auth !== `Bearer ${options.token}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }
    }

    // MCP endpoint
    if (req.url === '/mcp' || req.url === '/') {
      try {
        await transport.handleRequest(req, res)
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      }
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found. Use /mcp for MCP protocol or /health for status.' }))
  })

  const start = (): Promise<void> => {
    return new Promise((resolve) => {
      server.listen(options.port, options.host, () => {
        resolve()
      })
    })
  }

  return { transport, start }
}
