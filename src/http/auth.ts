import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';

/**
 * Bearer-token gate for the /mcp routes. Reads ONLY the Authorization header —
 * it must never touch the request body, which the MCP transport parses itself.
 *
 * Both the candidate and expected tokens are SHA-256 hashed to fixed 32-byte
 * digests before `timingSafeEqual`, so the comparison neither throws on
 * unequal lengths nor leaks the token length via an early return.
 */
export function requireBearerToken(expectedToken: string): MiddlewareHandler {
  const expectedTokenDigest = sha256Digest(expectedToken);
  return async (requestContext, next) => {
    const authorizationHeader = requestContext.req.header('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return unauthorizedResponse(requestContext);
    }
    const candidateToken = authorizationHeader.slice('Bearer '.length);
    const candidateTokenDigest = sha256Digest(candidateToken);
    if (!timingSafeEqual(candidateTokenDigest, expectedTokenDigest)) {
      return unauthorizedResponse(requestContext);
    }
    await next();
  };
}

function sha256Digest(tokenValue: string): Buffer {
  return createHash('sha256').update(tokenValue).digest();
}

function unauthorizedResponse(requestContext: Context): Response {
  return requestContext.json(
    {
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized: missing or invalid bearer token.' },
      id: null,
    },
    401,
  );
}
