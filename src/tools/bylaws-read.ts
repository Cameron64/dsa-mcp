import { z } from 'zod';
import { BYLAWS_FILE_PATH, DSA_CONTENT_REPOS } from '../domain/dsa-repos.js';
import { listMarkdownHeadings, sliceMarkdownSection } from './markdown-section.js';
import { defineDsaTool, toTextResult, type DsaMcpTool, type DsaToolContext } from './tool-types.js';

export function createBylawsReadTool(context: DsaToolContext): DsaMcpTool {
  return defineDsaTool({
    toolName: 'bylaws_read',
    description:
      'Read the Austin DSA bylaws (live from the Austin-DSA/Bylaws-Resolutions GitHub repo). Optionally pass bylawsSection to get just one section by heading text.',
    inputSchema: {
      bylawsSection: z
        .string()
        .optional()
        .describe('Optional heading text to return only that section (case-insensitive substring match)'),
    },
    execute: async ({ bylawsSection }) => {
      const bylawsMarkdown = await context.githubContentClient.fetchRepoFileMarkdown({
        repoName: DSA_CONTENT_REPOS.bylawsResolutions.repoName,
        branch: DSA_CONTENT_REPOS.bylawsResolutions.defaultBranch,
        filePath: BYLAWS_FILE_PATH,
      });
      if (bylawsSection === undefined) {
        return toTextResult(bylawsMarkdown);
      }
      const bylawsSectionMarkdown = sliceMarkdownSection(bylawsMarkdown, bylawsSection);
      if (bylawsSectionMarkdown === null) {
        const availableHeadings = listMarkdownHeadings(bylawsMarkdown).join('\n');
        return toTextResult(
          `No bylaws section heading matched "${bylawsSection}". Available headings:\n${availableHeadings}`,
          true,
        );
      }
      return toTextResult(bylawsSectionMarkdown);
    },
  });
}
