import OpenAI from 'openai'
import type { FileChangeSummary } from '../../commit/domain/CommitPlan'
import type { LLMService } from '../domain/llm.service'
import type { GitService } from '../../git/domain/git.service'
import { ConfigService } from '@core/config'
import { Inject, Injectable } from '@core/container'
import { BunGitService } from '@git/infrastructure/BunGitService'

@Injectable()
export class OpenAiService implements LLMService {
  private readonly openai: OpenAI

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(BunGitService) private readonly gitService: GitService,
  ) {
    const apiKey = configService.get('OPENAI_API_KEY')

    this.openai = new OpenAI({ apiKey })
  }

  async summarizeDiffs(
    diffs: Record<string, string>,
  ): Promise<FileChangeSummary[]> {
    const summaries: FileChangeSummary[] = []

    for (const [file, diff] of Object.entries(diffs)) {
      let summary: string
      let type: FileChangeSummary['type'] = 'chore'

      if (!diff) {
        // Check if the file is new (not tracked)
        const status = await this.gitService.getStatusPorcelain()
        const fileStatus = status.find((f) => f.path === file)

        if (fileStatus?.status === '??') {
          summary = `Add new file: ${file}`
          type = 'feat'
        } else {
          summary = `Update ${file}`
          type = 'chore'
        }
      } else {
        const prompt = `Summarize the following diff and classify it as 'feat', 'fix', 'refactor', etc.:\n\n${diff}`

        const chat = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
        })

        const content = chat.choices[0]?.message.content ?? ''
        const [summaryLine, typeLine] = content
          .split('\n')
          .map((line) => line.trim())
        summary = summaryLine
        type = (typeLine as FileChangeSummary['type']) || 'chore'
      }

      summaries.push({
        file,
        summary,
        type,
      })
    }

    return summaries
  }

  async suggestCommits(summaries: FileChangeSummary[]): Promise<string> {
    const prompt = `Given these changes, group them into logical commits. Each commit should have a clear, focused purpose.
    
Changes:
${summaries.map((s) => `- ${s.file}: ${s.summary}`).join('\n')}

Return the commits in this format:
commit1: message1
files: file1, file2

commit2: message2
files: file3, file4

...`

    const chat = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    })

    return chat.choices[0]?.message.content ?? ''
  }
}
