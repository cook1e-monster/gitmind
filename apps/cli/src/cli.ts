import { Inject, Injectable } from '@core/container'
import { CommitWorkflowUseCase } from '@workflow/application/commit-workflow.use-case'

@Injectable()
export class Cli {
  constructor(
    @Inject(CommitWorkflowUseCase)
    private readonly workflow: CommitWorkflowUseCase,
  ) {}

  async start() {
    try {
      await this.workflow.execute()
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ Error:', error.message)
      } else {
        console.error('❌ An unexpected error occurred')
      }
      process.exit(1)
    }
  }
}
