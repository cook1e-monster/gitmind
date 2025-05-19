import {
  type FileChangeSummary,
  CommitPlan,
  type Commit,
} from '../domain/CommitPlan'
import type { LLMService } from '../../llm/domain/llm.service'

export class PlanCommitsUseCase {
  constructor(private llmService: LLMService) {}

  async execute(summaries: FileChangeSummary[]): Promise<CommitPlan> {
    // Group files by type first
    const groupedByType = summaries.reduce(
      (acc, summary) => {
        if (!acc[summary.type]) {
          acc[summary.type] = []
        }
        acc[summary.type].push(summary)
        return acc
      },
      {} as Record<FileChangeSummary['type'], FileChangeSummary[]>,
    )

    const commits: Commit[] = []

    // For each type, let the LLM decide if we should split into multiple commits
    for (const [type, typeSummaries] of Object.entries(groupedByType)) {
      const prompt = `Given these changes of type ${type}, group them into logical commits. Each commit should have a clear, focused purpose.
      
Changes:
${typeSummaries.map((s) => `- ${s.file}: ${s.summary}`).join('\n')}

Return the commits in this format:
commit1: message1
files: file1, file2

commit2: message2
files: file3, file4

...`

      const response = await this.llmService.suggestCommits(typeSummaries)
      const commitGroups = response.split('\n\n').filter(Boolean)

      for (const group of commitGroups) {
        const [message, filesLine] = group.split('\n')
        const files = filesLine
          .replace('files:', '')
          .trim()
          .split(',')
          .map((f) => f.trim())

        commits.push({
          message: message.replace(/^commit\d+:\s*/, ''),
          files,
          type: type as FileChangeSummary['type'],
        })
      }
    }

    // Let the LLM decide if we should create a new branch
    const shouldCreateBranch = commits.some(
      (c) => c.type === 'feat' || c.type === 'fix',
    )
    const branchName = shouldCreateBranch
      ? `gitmind/${commits[0].type}/${Date.now()}`
      : undefined

    return new CommitPlan(commits, branchName)
  }
}
