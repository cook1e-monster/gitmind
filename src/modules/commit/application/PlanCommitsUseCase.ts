import { type FileChangeSummary, CommitPlan } from '../domain/CommitPlan'

export class PlanCommitsUseCase {
  async execute(summaries: FileChangeSummary[]): Promise<CommitPlan> {
    const messages = summaries.map((s) => `${s.type}: ${s.summary}`)
    const branchName = `auto/${summaries[0]?.type || 'chore'}-${Date.now()}`
    return new CommitPlan(messages, branchName)
  }
}
