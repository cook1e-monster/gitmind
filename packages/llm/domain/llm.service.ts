import type { FileChangeSummary } from '@commit/domain/CommitPlan'

export interface LLMService {
  summarizeDiffs(diffs: Record<string, string>): Promise<FileChangeSummary[]>
  suggestCommits(prompt: string): Promise<string>
}
