export interface OutlineDocumentSearchHit {
  documentTitle: string;
  documentUrlId: string;
  contextSnippet: string;
}

export class OutlineApiError extends Error {
  constructor(
    message: string,
    readonly outlineErrorCode: string | null,
  ) {
    super(message);
    this.name = 'OutlineApiError';
  }
}

interface OutlineSearchResultItem {
  context: string;
  document: {
    id: string;
    title: string;
    urlId: string;
  };
}

interface OutlineResponseEnvelope {
  ok?: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

/**
 * RPC wrapper for the self-hosted Outline wiki (`POST https://<host>/api/<method>`).
 * Degrades gracefully: when no token is configured, `isConfigured()` is false and
 * tools return a "not configured" message instead of calling through.
 */
export class OutlineWikiClient {
  constructor(
    private readonly options: {
      outlineHost: string;
      outlineApiToken: string | null;
    },
  ) {}

  isConfigured(): boolean {
    return this.options.outlineApiToken !== null;
  }

  async searchDocuments(wikiSearchQuery: string, resultLimit: number): Promise<OutlineDocumentSearchHit[]> {
    const searchResultItems = await this.callOutlineMethod<OutlineSearchResultItem[]>('documents.search', {
      query: wikiSearchQuery,
      limit: resultLimit,
    });
    return searchResultItems.map((searchResultItem) => ({
      documentTitle: searchResultItem.document.title,
      documentUrlId: searchResultItem.document.urlId,
      contextSnippet: searchResultItem.context,
    }));
  }

  async exportDocumentMarkdown(wikiDocumentId: string): Promise<string> {
    return this.callOutlineMethod<string>('documents.export', { id: wikiDocumentId });
  }

  private async callOutlineMethod<TData>(methodName: string, requestBody: Record<string, unknown>): Promise<TData> {
    if (this.options.outlineApiToken === null) {
      throw new OutlineApiError('OUTLINE_API_TOKEN is not configured.', 'not_configured');
    }
    const sendOutlineRequest = (): Promise<Response> =>
      fetch(`https://${this.options.outlineHost}/api/${methodName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.outlineApiToken}`,
        },
        body: JSON.stringify(requestBody),
      });

    let outlineResponse = await sendOutlineRequest();
    if (outlineResponse.status === 429) {
      const retryAfterSeconds = Number(outlineResponse.headers.get('Retry-After')) || 1;
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfterSeconds, 10) * 1000));
      outlineResponse = await sendOutlineRequest();
    }

    const responseEnvelope = (await outlineResponse.json().catch(() => null)) as OutlineResponseEnvelope | null;
    if (!outlineResponse.ok || responseEnvelope === null || responseEnvelope.ok === false) {
      throw new OutlineApiError(
        responseEnvelope?.message ?? `Outline API '${methodName}' failed with HTTP ${outlineResponse.status}.`,
        responseEnvelope?.error ?? null,
      );
    }
    return responseEnvelope.data as TData;
  }
}
