import { DSA_GITHUB_OWNER } from '../domain/dsa-repos.js';

export interface CachedRepoFile {
  fetchedAt: number;
  contentMarkdown: string;
}

export interface RepoBlobEntry {
  blobPath: string;
  byteSize: number;
}

interface CachedRepoTree {
  fetchedAt: number;
  blobEntries: RepoBlobEntry[];
}

export interface RepoFileRef {
  repoName: string;
  branch: string;
  filePath: string;
}

export interface RepoTreeRef {
  repoName: string;
  branch: string;
  subPathPrefix?: string;
}

export class RepoAccessDeniedError extends Error {
  constructor(repoName: string, filePath?: string) {
    super(
      filePath === undefined
        ? `Repo '${repoName}' is not on the v1 allow-list.`
        : `Path '${filePath}' in repo '${repoName}' is not on the v1 allow-list.`,
    );
    this.name = 'RepoAccessDeniedError';
  }
}

export class RepoFileNotFoundError extends Error {
  constructor(repoFileRef: RepoFileRef) {
    super(`File '${repoFileRef.filePath}' not found in ${DSA_GITHUB_OWNER}/${repoFileRef.repoName}@${repoFileRef.branch}.`);
    this.name = 'RepoFileNotFoundError';
  }
}

interface GithubTreeEntry {
  path: string;
  type: string;
  size?: number;
}

interface GithubTreeResponse {
  tree: GithubTreeEntry[];
  truncated: boolean;
}

/**
 * Fetches Austin DSA content from public GitHub repos at runtime, with an
 * in-memory TTL cache and a hard (repo, path-prefix) allow-list so no tool
 * can ever proxy files outside the v1 content set.
 */
export class GithubContentClient {
  private readonly fileCache = new Map<string, CachedRepoFile>();
  private readonly treeCache = new Map<string, CachedRepoTree>();

  constructor(
    private readonly options: {
      githubToken: string | null;
      cacheTtlMs: number;
      allowedRepoPaths: ReadonlyMap<string, readonly string[]>;
    },
  ) {}

  async fetchRepoFileMarkdown(repoFileRef: RepoFileRef): Promise<string> {
    this.assertPathAllowed(repoFileRef.repoName, repoFileRef.filePath);
    const fileCacheKey = `${repoFileRef.repoName}:${repoFileRef.branch}:${repoFileRef.filePath}`;
    const cachedFile = this.fileCache.get(fileCacheKey);
    if (cachedFile && Date.now() - cachedFile.fetchedAt < this.options.cacheTtlMs) {
      return cachedFile.contentMarkdown;
    }

    const encodedFilePath = repoFileRef.filePath.split('/').map(encodeURIComponent).join('/');
    const rawFileUrl = `https://raw.githubusercontent.com/${DSA_GITHUB_OWNER}/${repoFileRef.repoName}/${repoFileRef.branch}/${encodedFilePath}`;
    const rawFileResponse = await fetch(rawFileUrl, { headers: this.buildRequestHeaders() });
    if (rawFileResponse.status === 404) {
      throw new RepoFileNotFoundError(repoFileRef);
    }
    if (!rawFileResponse.ok) {
      throw new Error(
        `GitHub raw fetch failed (HTTP ${rawFileResponse.status}) for ${rawFileUrl}. ` +
          'If this is a rate limit, set GITHUB_TOKEN to raise it.',
      );
    }
    const contentMarkdown = await rawFileResponse.text();
    this.fileCache.set(fileCacheKey, { fetchedAt: Date.now(), contentMarkdown });
    return contentMarkdown;
  }

  async listRepoBlobEntries(repoTreeRef: RepoTreeRef): Promise<RepoBlobEntry[]> {
    this.assertRepoAllowed(repoTreeRef.repoName);
    const treeCacheKey = `${repoTreeRef.repoName}:${repoTreeRef.branch}`;
    const cachedTree = this.treeCache.get(treeCacheKey);
    let blobEntries: RepoBlobEntry[];
    if (cachedTree && Date.now() - cachedTree.fetchedAt < this.options.cacheTtlMs) {
      blobEntries = cachedTree.blobEntries;
    } else {
      const treeApiUrl = `https://api.github.com/repos/${DSA_GITHUB_OWNER}/${repoTreeRef.repoName}/git/trees/${encodeURIComponent(repoTreeRef.branch)}?recursive=1`;
      const treeResponse = await fetch(treeApiUrl, { headers: this.buildRequestHeaders() });
      if (!treeResponse.ok) {
        throw new Error(
          `GitHub tree fetch failed (HTTP ${treeResponse.status}) for ${DSA_GITHUB_OWNER}/${repoTreeRef.repoName}@${repoTreeRef.branch}. ` +
            'If this is a rate limit, set GITHUB_TOKEN to raise it.',
        );
      }
      const treeJson = (await treeResponse.json()) as GithubTreeResponse;
      blobEntries = treeJson.tree
        .filter((entry) => entry.type === 'blob')
        .map((entry) => ({ blobPath: entry.path, byteSize: entry.size ?? 0 }));
      this.treeCache.set(treeCacheKey, { fetchedAt: Date.now(), blobEntries });
    }
    if (repoTreeRef.subPathPrefix === undefined) {
      return blobEntries;
    }
    const normalizedPrefix = repoTreeRef.subPathPrefix.endsWith('/')
      ? repoTreeRef.subPathPrefix
      : `${repoTreeRef.subPathPrefix}/`;
    return blobEntries.filter((blobEntry) => blobEntry.blobPath.startsWith(normalizedPrefix));
  }

  private buildRequestHeaders(): Record<string, string> {
    const requestHeaders: Record<string, string> = { 'User-Agent': 'dsa-mcp-server' };
    if (this.options.githubToken) {
      requestHeaders['Authorization'] = `token ${this.options.githubToken}`;
    }
    return requestHeaders;
  }

  private assertRepoAllowed(repoName: string): readonly string[] {
    const allowedPathPrefixes = this.options.allowedRepoPaths.get(repoName);
    if (allowedPathPrefixes === undefined) {
      throw new RepoAccessDeniedError(repoName);
    }
    return allowedPathPrefixes;
  }

  private assertPathAllowed(repoName: string, filePath: string): void {
    const allowedPathPrefixes = this.assertRepoAllowed(repoName);
    if (filePath.split('/').includes('..')) {
      throw new RepoAccessDeniedError(repoName, filePath);
    }
    const filePathIsAllowed = allowedPathPrefixes.some(
      (pathPrefix) => pathPrefix === '' || filePath === pathPrefix || filePath.startsWith(pathPrefix),
    );
    if (!filePathIsAllowed) {
      throw new RepoAccessDeniedError(repoName, filePath);
    }
  }
}
