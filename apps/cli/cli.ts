import { Inject, Injectable } from '@core/container'
import { CommitWorkflowUseCase } from '@workflow/application/commit-workflow.use-case'
import { InquirerInteractionService } from '@cli-interaction/infrastructure/inquirer-interaction.service'

@Injectable()
export class Cli {
  constructor(
    @Inject(CommitWorkflowUseCase)
    private readonly workflow: CommitWorkflowUseCase,
    @Inject(InquirerInteractionService)
    private readonly interaction: InquirerInteractionService,
  ) {}

  async start() {
    const changed = await this.workflow.getChangedFiles()

    const filesToProcess = await this.interaction.selectFiles(changed)

    const { plan } = await this.workflow.generateSummariesAndPlan(
      filesToProcess,
      changed,
    )

    const { confirmed } = await this.interaction.confirmBranch(plan.branchName!)

    if (confirmed) {
      await this.workflow.createNewBranch(plan.branchName!)
    }

    const finalCommits = await this.interaction.reviewCommits(plan.commits)

    if (finalCommits.length === 0) {
      console.log('❌ No commits to execute.')
      return
    }

    const shouldExecute = await this.interaction.confirmExecution(
      finalCommits.length,
    )

    if (shouldExecute) {
      await this.workflow.executeCommits(finalCommits)

      const shouldPush = await this.interaction.confirmPush()

      if (shouldPush) {
        await this.workflow.pushChanges(plan.branchName)
      }
    }
  }
}
