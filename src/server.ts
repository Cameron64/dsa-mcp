import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { GithubContentClient } from './clients/github-content-client.js';
import { OutlineWikiClient } from './clients/outline-wiki-client.js';
import { loadAppConfig } from './config.js';
import { V1_ALLOWED_REPO_PATH_PREFIXES } from './domain/dsa-repos.js';
import { requireBearerToken } from './http/auth.js';
import { buildAllDsaTools } from './tools/index.js';
import type { DsaToolContext } from './tools/tool-types.js';

const appConfig = loadAppConfig();

// Clients and tool definitions are built ONCE at startup (immutable, DI'd into
// tools). Only the McpServer + transport are per-request (stateless mode).
const toolContext: DsaToolContext = {
  githubContentClient: new GithubContentClient({
    githubToken: appConfig.githubToken,
    cacheTtlMs: appConfig.repoContentCacheTtlMs,
    allowedRepoPaths: V1_ALLOWED_REPO_PATH_PREFIXES,
  }),
  outlineWikiClient: new OutlineWikiClient({
    outlineHost: appConfig.outlineHost,
    outlineApiToken: appConfig.outlineApiToken,
  }),
};
const allDsaTools = buildAllDsaTools(toolContext);

const app = new Hono();

// Railway healthcheck — no auth, leaks nothing but liveness + startup success.
app.get('/health', (requestContext) =>
  requestContext.json({ status: 'ok', toolsLoaded: allDsaTools.length }),
);

// CORS intentionally omitted in v1: Claude Code is a non-browser client.
// Stateless per-request wiring mirrors the SDK's official Hono example
// (examples/server/honoWebStandardStreamableHttp). app.all covers POST/GET/DELETE
// so the transport answers each method per protocol instead of a Hono 404.
app.all('/mcp', requireBearerToken(appConfig.mcpAuthToken), async (requestContext) => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session affinity
    enableJsonResponse: true, // plain JSON responses, not SSE
  });
  const mcpServer = new McpServer({ name: 'dsa-mcp', version: '1.0.0' });
  allDsaTools.forEach((dsaTool) => dsaTool.registerOn(mcpServer));
  await mcpServer.connect(transport);
  // The body stream must reach the transport unconsumed (it parses req.json()
  // itself) — the bearer middleware reads only the Authorization header.
  return transport.handleRequest(requestContext.req.raw);
  // No transport.close(): the Response lifecycle is owned by Hono; the
  // per-request transport is garbage-collected after the response resolves.
});

serve({ fetch: app.fetch, port: appConfig.httpPort });
console.log(`dsa-mcp listening on port ${appConfig.httpPort} (${allDsaTools.length} tools registered per request)`);
