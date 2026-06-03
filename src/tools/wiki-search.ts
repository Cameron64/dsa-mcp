import { z } from 'zod';
import { defineDsaTool, toTextResult, type DsaMcpTool, type DsaToolContext } from './tool-types.js';

export function createWikiSearchTool(context: DsaToolContext): DsaMcpTool {
  return defineDsaTool({
    toolName: 'wiki_search',
    description:
      'Search the Austin DSA Outline wiki (wiki.austindsa.org). Returns matching document titles, urlIds (usable with wiki_document_read), and context snippets.',
    inputSchema: {
      wikiSearchQuery: z.string().min(1).describe('Full-text search query'),
      resultLimit: z.number().int().min(1).max(25).default(10).describe('Max results to return (1-25)'),
    },
    execute: async ({ wikiSearchQuery, resultLimit }) => {
      if (!context.outlineWikiClient.isConfigured()) {
        return toTextResult('Wiki search unavailable: OUTLINE_API_TOKEN is not set on the server.', true);
      }
      const wikiSearchHits = await context.outlineWikiClient.searchDocuments(wikiSearchQuery, resultLimit);
      if (wikiSearchHits.length === 0) {
        return toTextResult(`No wiki documents matched "${wikiSearchQuery}".`);
      }
      const formattedSearchHits = wikiSearchHits.map(
        (searchHit) => `- ${searchHit.documentTitle} (${searchHit.documentUrlId}): ${searchHit.contextSnippet}`,
      );
      return toTextResult(formattedSearchHits.join('\n'));
    },
  });
}
