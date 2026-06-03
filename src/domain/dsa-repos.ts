/**
 * Verified facts about the Austin DSA GitHub content repos (checked 2026-06-03).
 *
 * Only repos actually used by v1 tools are listed. `Membership-Engagment-Tools`
 * and `GeneralToolsWebsite` are intentionally ABSENT: no v1 tool reads them, and
 * the former tracks credential placeholder files that this server must never proxy.
 */
export const DSA_GITHUB_OWNER = 'Austin-DSA';

export interface DsaRepoRef {
  repoName: string;
  defaultBranch: string;
}

export const DSA_CONTENT_REPOS = {
  bylawsResolutions: { repoName: 'Bylaws-Resolutions', defaultBranch: 'main' },
  education: { repoName: 'education', defaultBranch: 'main' },
} as const satisfies Record<string, DsaRepoRef>;

export const BYLAWS_FILE_PATH = 'bylaws.md';
export const RESOLUTIONS_DIR_PATH = 'Resolutions';

/**
 * v1 fetch allow-list: the only (repoName → path prefixes) the GithubContentClient
 * may touch. A prefix of '' allows the whole repo tree. Prefixes ending in '/'
 * allow everything under that directory.
 */
export const V1_ALLOWED_REPO_PATH_PREFIXES: ReadonlyMap<string, readonly string[]> = new Map([
  [
    DSA_CONTENT_REPOS.bylawsResolutions.repoName,
    [BYLAWS_FILE_PATH, `${RESOLUTIONS_DIR_PATH}/`],
  ],
  [DSA_CONTENT_REPOS.education.repoName, ['']],
]);
