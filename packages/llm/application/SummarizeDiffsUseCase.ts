import type { LLMService } from '../domain/llm.service'
import { Inject, Injectable } from '@core/container'
import { OpenAiService } from '../infrastructure/OpenAiService'

@Injectable()
export class SummarizeDiffsUseCase {
  constructor(@Inject(OpenAiService) private llmService: LLMService) {}

  async execute(diffs: Record<string, string>) {
    return this.llmService.summarizeDiffs(diffs)
  }
}
