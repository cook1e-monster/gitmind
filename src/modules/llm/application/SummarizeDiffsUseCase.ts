import type { LLMService } from '../domain/llm.service'

export class SummarizeDiffsUseCase {
  constructor(private llmService: LLMService) {}

  async execute(diffs: Record<string, string>) {
    return this.llmService.summarizeDiffs(diffs)
  }
}
