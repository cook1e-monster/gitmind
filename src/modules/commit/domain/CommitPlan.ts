export interface FileChangeSummary {
  file: string
  summary: string
  type: 'feat' | 'fix' | 'chore' | 'refactor' | 'docs' | 'test'
}

export interface Commit {
  message: string
  files: string[]
  type: FileChangeSummary['type']
}

export class CommitPlan {
  constructor(
    public commits: Commit[],
    public branchName?: string,
  ) {}
}
