export interface FileChangeSummary {
  file: string
  summary: string
  type: 'feat' | 'fix' | 'chore' | 'refactor' | 'docs' | 'test'
}

export class CommitPlan {
  constructor(
    public messages: string[],
    public branchName?: string,
  ) {}
}
