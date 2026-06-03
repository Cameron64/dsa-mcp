import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ShapeOutput, ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import type { GithubContentClient } from '../clients/github-content-client.js';
import type { OutlineWikiClient } from '../clients/outline-wiki-client.js';

/** The `extra` argument the SDK passes to every tool callback. */
export type DsaToolRequestExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/** Text-only narrowing of the SDK's CallToolResult — every DSA tool returns plain text. */
export type McpToolTextResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

/** The single shaping site for tool results (DRY across all tools). */
export function toTextResult(resultText: string, isError = false): McpToolTextResult {
  return isError
    ? { content: [{ type: 'text', text: resultText }], isError: true }
    : { content: [{ type: 'text', text: resultText }] };
}

/** Shared dependencies injected into each tool factory. */
export interface DsaToolContext {
  githubContentClient: GithubContentClient;
  outlineWikiClient: OutlineWikiClient;
}

/**
 * One registered MCP tool. The input-schema generic is intentionally NOT on this
 * interface: a heterogeneous DsaMcpTool[] would erase it, making a central
 * `registerTool` loop fail to type-check. Instead `registerOn` (created by
 * `defineDsaTool`) closes over the bound generic and performs the registration.
 */
export interface DsaMcpTool {
  toolName: string;
  description: string;
  /** Type-erased view of the input shape — for listing/diagnostics only. */
  inputSchema: ZodRawShapeCompat;
  /** Registers this tool on the given McpServer with its input generic still bound. */
  registerOn(mcpServer: McpServer): void;
}

export interface DsaToolDefinition<TInput extends ZodRawShapeCompat> {
  toolName: string;
  description: string;
  inputSchema: TInput;
  execute: (toolArgs: ShapeOutput<TInput>, requestExtra: DsaToolRequestExtra) => Promise<McpToolTextResult>;
}

/**
 * Binds a fully-typed tool definition into a DsaMcpTool whose `registerOn`
 * keeps the schema↔args generic linkage alive at the `registerTool` call site.
 */
export function defineDsaTool<TInput extends ZodRawShapeCompat>(
  toolDefinition: DsaToolDefinition<TInput>,
): DsaMcpTool {
  return {
    toolName: toolDefinition.toolName,
    description: toolDefinition.description,
    inputSchema: toolDefinition.inputSchema,
    registerOn(mcpServer: McpServer): void {
      mcpServer.registerTool(
        toolDefinition.toolName,
        { description: toolDefinition.description, inputSchema: toolDefinition.inputSchema },
        // SAFE CAST: ToolCallback<TInput> is a conditional type that stays deferred
        // while TInput is generic, so TS rejects the (structurally compatible)
        // callback. The definition site (DsaToolDefinition) fully types execute
        // against ShapeOutput<TInput>, so this cast cannot hide an arg/schema
        // mismatch — it only bridges the deferred conditional.
        toolDefinition.execute as ToolCallback<TInput>,
      );
    },
  };
}
