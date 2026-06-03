import { z } from 'zod';
import { DSA_CONTENT_REPOS, RESOLUTIONS_DIR_PATH } from '../domain/dsa-repos.js';
import { defineDsaTool, toTextResult, type DsaMcpTool, type DsaToolContext } from './tool-types.js';

export function createResolutionsListTool(context: DsaToolContext): DsaMcpTool {
  return defineDsaTool({
    toolName: 'resolutions_list',
    description:
      'List Austin DSA chapter resolutions (live from the Austin-DSA/Bylaws-Resolutions GitHub repo), grouped by year. Optionally filter to one year.',
    inputSchema: {
      resolutionYear: z.string().optional().describe('Optional year filter, e.g. "2024"'),
    },
    execute: async ({ resolutionYear }) => {
      const resolutionBlobEntries = await context.githubContentClient.listRepoBlobEntries({
        repoName: DSA_CONTENT_REPOS.bylawsResolutions.repoName,
        branch: DSA_CONTENT_REPOS.bylawsResolutions.defaultBranch,
        subPathPrefix: RESOLUTIONS_DIR_PATH,
      });
      const resolutionNamesByYear = new Map<string, string[]>();
      for (const resolutionBlobEntry of resolutionBlobEntries) {
        // Paths look like: Resolutions/<year>/<file> (or rarely Resolutions/<file>)
        const pathSegments = resolutionBlobEntry.blobPath.split('/');
        const yearSegment = pathSegments.length >= 3 ? (pathSegments[1] ?? '(unknown)') : '(no year)';
        const resolutionFileName = pathSegments.slice(pathSegments.length >= 3 ? 2 : 1).join('/');
        const yearResolutionNames = resolutionNamesByYear.get(yearSegment) ?? [];
        yearResolutionNames.push(resolutionFileName);
        resolutionNamesByYear.set(yearSegment, yearResolutionNames);
      }
      const requestedYears =
        resolutionYear === undefined
          ? [...resolutionNamesByYear.keys()].sort()
          : [...resolutionNamesByYear.keys()].filter((yearSegment) => yearSegment === resolutionYear);
      if (requestedYears.length === 0) {
        const knownYears = [...resolutionNamesByYear.keys()].sort().join(', ');
        return toTextResult(
          `No resolutions found for year "${resolutionYear ?? ''}". Known years: ${knownYears || '(none)'}.`,
          true,
        );
      }
      const formattedYearGroups = requestedYears.map((yearSegment) => {
        const yearResolutionNames = (resolutionNamesByYear.get(yearSegment) ?? [])
          .sort()
          .map((resolutionFileName) => `  - ${resolutionFileName}`)
          .join('\n');
        return `${yearSegment}:\n${yearResolutionNames}`;
      });
      return toTextResult(formattedYearGroups.join('\n'));
    },
  });
}
