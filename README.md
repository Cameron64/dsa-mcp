# dsa-mcp

Personal-use MCP server exposing **Austin DSA** domain knowledge as tools over the MCP
**Streamable HTTP** transport. Runs always-on on [Railway](https://railway.com) (GitHub
push-to-deploy), so nothing needs starting by hand.

**No DSA content and no secrets are committed to this repo.** Bylaws/resolutions/education
content is fetched live from the public [Austin-DSA](https://github.com/Austin-DSA) GitHub
org at request time (15-min in-memory cache); wiki content comes from the chapter's
self-hosted Outline instance via its API.

## Tools (v1)

| Tool | What it does | Source |
|---|---|---|
| `wiki_search` | Full-text search of the Austin DSA wiki | Outline API (`documents.search`) |
| `wiki_document_read` | Fetch one wiki document as markdown | Outline API (`documents.export`) |
| `bylaws_read` | Read the chapter bylaws (whole or one section by heading) | `Austin-DSA/Bylaws-Resolutions` |
| `resolutions_list` | List chapter resolutions grouped by year | `Austin-DSA/Bylaws-Resolutions` |
| `resolutions_read` | Read one resolution by year + filename | `Austin-DSA/Bylaws-Resolutions` |
| `education_list` | List political-education materials (flags empty stubs) | `Austin-DSA/education` |
| `education_read` | Read one education doc (raw AsciiDoc/markdown) | `Austin-DSA/education` |
| `infra_reference` | Static chapter hosting/cost/capacity reference (dated snapshot) | embedded |

## Architecture

- **Node 22 + TypeScript (strict, ESM)**, [Hono](https://hono.dev) HTTP shell — no Express.
- `@modelcontextprotocol/sdk` `WebStandardStreamableHTTPServerTransport` in **stateless
  mode** (`sessionIdGenerator: undefined`, `enableJsonResponse: true`): a fresh
  `McpServer` + transport per request, mirroring the SDK's official Hono example.
- **Auth**: static bearer token on all `/mcp` routes (SHA-256 + `timingSafeEqual`;
  header-only so the request body stream reaches the transport unconsumed).
  `GET /health` is the only unauthenticated route.
- **Content allow-list**: the GitHub client can only fetch from an explicit
  (repo, path-prefix) allow-list — repos with committed credential placeholder files are
  unreachable by construction.
- **Flexible registry**: adding a tool = one new file in `src/tools/` using
  `defineDsaTool(...)` + one line in `src/tools/index.ts`.
- CORS intentionally omitted in v1 (Claude Code is a non-browser client).
  claude.ai Connector support (OAuth) is a possible v2.

## Local development

```bash
npm install
cp .env.example .env       # fill in MCP_AUTH_TOKEN (and optionally OUTLINE_API_TOKEN)
npm run dev                # loads .env, watches src/
curl http://localhost:3000/health
```

Checks: `npm run typecheck` · `npm run build` · `npm test`

## Deploy (Railway)

1. `railway login` && `railway init` in this directory.
2. In the Railway dashboard, connect the service to this GitHub repo (watched branch
   `main`) — every push auto-deploys. `railway.json` provides the start command,
   `/health` healthcheck, and on-failure restart policy.
3. Set env vars (never commit them):
   ```bash
   railway variables --set MCP_AUTH_TOKEN=<long random> --set OUTLINE_API_TOKEN=<ol_api_...>
   ```
4. `railway domain` to generate the public URL, then verify
   `curl https://<domain>/health` → `{"status":"ok","toolsLoaded":8}`.

## Connect from Claude Code

```bash
claude mcp add --transport http dsa https://<your-railway-domain>/mcp \
  --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
```

v1 targets Claude Code only — the claude.ai Connectors flow expects OAuth and is out of
scope until v2.

## License

MIT
