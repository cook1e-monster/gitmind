import type { Commit } from '@commit/domain/commit-plan'

export interface FileStatus {
  path: string
  status: string
}

export interface InteractionService {
  selectFiles(changed: FileStatus[]): Promise<string[]>
  confirmBranch(
    branchName: string,
  ): Promise<{ confirmed: boolean; name: string }>
  reviewCommits(commits: Commit[]): Promise<Commit[]>
  confirmExecution(commitCount: number): Promise<boolean>
  confirmPush(): Promise<boolean>
  createPullRequestData(
    commits: Commit[],
  ): Promise<{ title: string; body: string }>
}
