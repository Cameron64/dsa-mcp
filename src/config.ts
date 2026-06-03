export interface AppConfig {
  httpPort: number;
  mcpAuthToken: string;
  outlineApiToken: string | null;
  outlineHost: string;
  githubToken: string | null;
  repoContentCacheTtlMs: number;
}

const DEFAULT_HTTP_PORT = 3000;
const DEFAULT_OUTLINE_HOST = 'wiki.austindsa.org';
const DEFAULT_REPO_CONTENT_CACHE_TTL_MS = 900_000; // 15 minutes

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mcpAuthToken = env.MCP_AUTH_TOKEN;
  if (!mcpAuthToken) {
    throw new Error(
      'MCP_AUTH_TOKEN is required — the server must never run unprotected. ' +
        'Set it in the environment (see .env.example).',
    );
  }
  return {
    httpPort: Number(env.PORT) || DEFAULT_HTTP_PORT,
    mcpAuthToken,
    outlineApiToken: env.OUTLINE_API_TOKEN || null,
    outlineHost: env.OUTLINE_HOST || DEFAULT_OUTLINE_HOST,
    githubToken: env.GITHUB_TOKEN || null,
    repoContentCacheTtlMs: Number(env.REPO_CONTENT_CACHE_TTL_MS) || DEFAULT_REPO_CONTENT_CACHE_TTL_MS,
  };
}
