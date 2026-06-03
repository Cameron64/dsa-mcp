import { z } from 'zod';
import { RepoFileNotFoundError } from '../clients/github-content-client.js';
import { DSA_CONTENT_REPOS } from '../domain/dsa-repos.js';
import { defineDsaTool, toTextResult, type DsaMcpTool, type DsaToolContext } from './tool-types.js';

export function createEducationReadTool(context: DsaToolContext): DsaMcpTool {
  return defineDsaTool({
    toolName: 'education_read',
    description:
      'Read one Austin DSA education document by repo path (as listed by education_list). Returns raw AsciiDoc/markdown source.',
    inputSchema: {
      educationDocPath: z.string().min(1).describe('Path within the education repo, e.g. "computer_security/main.adoc"'),
    },
    execute: async ({ educationDocPath }) => {
      try {
        const educationDocSource = await context.githubContentClient.fetchRepoFileMarkdown({
          repoName: DSA_CONTENT_REPOS.education.repoName,
          branch: DSA_CONTENT_REPOS.education.defaultBranch,
          filePath: educationDocPath,
        });
        if (educationDocSource.trim() === '') {
          return toTextResult(`'${educationDocPath}' exists but is an empty stub (no content yet).`);
        }
        return toTextResult(educationDocSource);
      } catch (fetchError) {
        if (fetchError instanceof RepoFileNotFoundError) {
          return toTextResult(`${fetchError.message} Use education_list to see available documents.`, true);
        }
        throw fetchError;
      }
    },
  });
}
