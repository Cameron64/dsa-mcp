import { DSA_CONTENT_REPOS } from '../domain/dsa-repos.js';
import { defineDsaTool, toTextResult, type DsaMcpTool, type DsaToolContext } from './tool-types.js';

const EDUCATION_DOC_EXTENSIONS = ['.adoc', '.md'];

export function createEducationListTool(context: DsaToolContext): DsaMcpTool {
  return defineDsaTool({
    toolName: 'education_list',
    description:
      'List Austin DSA political-education materials (live from the Austin-DSA/education GitHub repo). Flags empty stub files — much of this repo is still skeletal.',
    // No inputs yet — the repo is small enough to list whole.
    inputSchema: {},
    execute: async () => {
      const educationBlobEntries = await context.githubContentClient.listRepoBlobEntries({
        repoName: DSA_CONTENT_REPOS.education.repoName,
        branch: DSA_CONTENT_REPOS.education.defaultBranch,
      });
      const educationDocEntries = educationBlobEntries.filter((blobEntry) =>
        EDUCATION_DOC_EXTENSIONS.some((docExtension) => blobEntry.blobPath.toLowerCase().endsWith(docExtension)),
      );
      if (educationDocEntries.length === 0) {
        return toTextResult('No education documents found in the Austin-DSA/education repo.');
      }
      const formattedEducationDocs = educationDocEntries.map((blobEntry) =>
        blobEntry.byteSize === 0 ? `- ${blobEntry.blobPath} (empty stub)` : `- ${blobEntry.blobPath} (${blobEntry.byteSize} bytes)`,
      );
      return toTextResult(formattedEducationDocs.join('\n'));
    },
  });
}
