import { z } from 'zod';
import { OutlineApiError } from '../clients/outline-wiki-client.js';
import { defineDsaTool, toTextResult, type DsaMcpTool, type DsaToolContext } from './tool-types.js';

export function createWikiDocumentReadTool(context: DsaToolContext): DsaMcpTool {
  return defineDsaTool({
    toolName: 'wiki_document_read',
    description:
      'Fetch one Austin DSA wiki document as markdown by its document id or urlId (as returned by wiki_search).',
    inputSchema: {
      wikiDocumentId: z.string().min(1).describe('Outline document UUID or urlId'),
    },
    execute: async ({ wikiDocumentId }) => {
      if (!context.outlineWikiClient.isConfigured()) {
        return toTextResult('Wiki document read unavailable: OUTLINE_API_TOKEN is not set on the server.', true);
      }
      try {
        const documentMarkdown = await context.outlineWikiClient.exportDocumentMarkdown(wikiDocumentId);
        return toTextResult(documentMarkdown);
      } catch (wikiError) {
        if (wikiError instanceof OutlineApiError && wikiError.outlineErrorCode === 'not_found') {
          return toTextResult(
            `Wiki document '${wikiDocumentId}' was not found — it may not exist, or it is a private draft this server's token cannot see.`,
            true,
          );
        }
        throw wikiError;
      }
    },
  });
}
