import { z } from 'zod';
import { RepoFileNotFoundError } from '../clients/github-content-client.js';
import { DSA_CONTENT_REPOS, DSA_GITHUB_OWNER, RESOLUTIONS_DIR_PATH } from '../domain/dsa-repos.js';
import { defineDsaTool, toTextResult, type DsaMcpTool, type DsaToolContext } from './tool-types.js';

export function createResolutionsReadTool(context: DsaToolContext): DsaMcpTool {
  return defineDsaTool({
    toolName: 'resolutions_read',
    description:
      'Read one Austin DSA resolution by year and filename (as listed by resolutions_list). Returns the resolution markdown.',
    inputSchema: {
      resolutionYear: z.string().min(4).describe('Year directory, e.g. "2024"'),
      resolutionName: z.string().min(1).describe('Resolution filename; ".md" is appended if no extension given'),
    },
    execute: async ({ resolutionYear, resolutionName }) => {
      const hasFileExtension = /\.[a-z0-9]+$/i.test(resolutionName);
      const resolutionFileName = hasFileExtension ? resolutionName : `${resolutionName}.md`;
      const resolutionFilePath = `${RESOLUTIONS_DIR_PATH}/${resolutionYear}/${resolutionFileName}`;

      if (resolutionFileName.toLowerCase().endsWith('.pdf')) {
        const encodedPdfPath = resolutionFilePath.split('/').map(encodeURIComponent).join('/');
        const { repoName, defaultBranch } = DSA_CONTENT_REPOS.bylawsResolutions;
        return toTextResult(
          `'${resolutionFileName}' is a PDF (binary, not text-readable here). Raw URL: ` +
            `https://raw.githubusercontent.com/${DSA_GITHUB_OWNER}/${repoName}/${defaultBranch}/${encodedPdfPath}`,
        );
      }

      try {
        const resolutionMarkdown = await context.githubContentClient.fetchRepoFileMarkdown({
          repoName: DSA_CONTENT_REPOS.bylawsResolutions.repoName,
          branch: DSA_CONTENT_REPOS.bylawsResolutions.defaultBranch,
          filePath: resolutionFilePath,
        });
        return toTextResult(resolutionMarkdown);
      } catch (fetchError) {
        if (fetchError instanceof RepoFileNotFoundError) {
          return toTextResult(`${fetchError.message} Use resolutions_list to see available resolutions.`, true);
        }
        throw fetchError;
      }
    },
  });
}
