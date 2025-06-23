export interface GitHubService {
  getRepositoryInfo(): Promise<{ owner: string; repo: string }>
  createPullRequest(
    title: string,
    body: string,
    baseBranch: string,
    headBranch: string,
  ): Promise<void>
  getToken(): string
}
