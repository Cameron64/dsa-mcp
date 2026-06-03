import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GithubContentClient } from '../src/clients/github-content-client.js';
import { OutlineWikiClient } from '../src/clients/outline-wiki-client.js';
import { V1_ALLOWED_REPO_PATH_PREFIXES } from '../src/domain/dsa-repos.js';
import { buildAllDsaTools } from '../src/tools/index.js';
import type { DsaToolContext } from '../src/tools/tool-types.js';

const EXPECTED_TOOL_NAMES = [
  'bylaws_read',
  'education_list',
  'education_read',
  'infra_reference',
  'resolutions_list',
  'resolutions_read',
  'wiki_document_read',
  'wiki_search',
];

/** Offline context: real client classes, no token — nothing here hits the network. */
function buildOfflineToolContext(): DsaToolContext {
  return {
    githubContentClient: new GithubContentClient({
      githubToken: null,
      cacheTtlMs: 900_000,
      allowedRepoPaths: V1_ALLOWED_REPO_PATH_PREFIXES,
    }),
    outlineWikiClient: new OutlineWikiClient({
      outlineHost: 'wiki.austindsa.org',
      outlineApiToken: null,
    }),
  };
}

async function connectInMemoryMcpPair(): Promise<Client> {
  const mcpServer = new McpServer({ name: 'dsa-mcp-smoke', version: '0.0.0' });
  buildAllDsaTools(buildOfflineToolContext()).forEach((dsaTool) => dsaTool.registerOn(mcpServer));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: 'dsa-mcp-smoke-client', version: '0.0.0' });
  await Promise.all([mcpServer.connect(serverTransport), mcpClient.connect(clientTransport)]);
  return mcpClient;
}

function firstTextBlock(toolCallResult: { content?: unknown }): string {
  const contentBlocks = (toolCallResult.content ?? []) as { type: string; text?: string }[];
  return contentBlocks[0]?.text ?? '';
}

test('registry exposes exactly the expected v1 tools', () => {
  const allDsaToolNames = buildAllDsaTools(buildOfflineToolContext())
    .map((dsaTool) => dsaTool.toolName)
    .sort();
  assert.deepEqual(allDsaToolNames, EXPECTED_TOOL_NAMES);
});

test('all tools register and are listed through a real MCP client', async () => {
  const mcpClient = await connectInMemoryMcpPair();
  try {
    const toolListResult = await mcpClient.listTools();
    const listedToolNames = toolListResult.tools.map((listedTool) => listedTool.name).sort();
    assert.deepEqual(listedToolNames, EXPECTED_TOOL_NAMES);
  } finally {
    await mcpClient.close();
  }
});

test('infra_reference executes offline with dated, estimate-labeled content', async () => {
  const mcpClient = await connectInMemoryMcpPair();
  try {
    const infraCallResult = await mcpClient.callTool({
      name: 'infra_reference',
      arguments: { infraTopic: 'cost' },
    });
    const infraReferenceText = firstTextBlock(infraCallResult);
    assert.ok(infraReferenceText.includes('2026-05-31'), 'snapshot date must appear in returned text');
    assert.ok(infraReferenceText.includes('ESTIMATE'), 'cost figures must be labeled ESTIMATE');
  } finally {
    await mcpClient.close();
  }
});

test('wiki_search degrades gracefully when OUTLINE_API_TOKEN is unset', async () => {
  const mcpClient = await connectInMemoryMcpPair();
  try {
    const wikiSearchResult = await mcpClient.callTool({
      name: 'wiki_search',
      arguments: { wikiSearchQuery: 'anything' },
    });
    assert.ok(firstTextBlock(wikiSearchResult).includes('OUTLINE_API_TOKEN'));
  } finally {
    await mcpClient.close();
  }
});
