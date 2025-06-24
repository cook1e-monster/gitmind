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

    const summaries = await this.workflow.generateSummaries(
      filesToProcess,
      changed,
    )

    const plan = await this.workflow.generatePlan(summaries)

    // If the plan has a branch name, we need to confirm it
    if (plan.branchName) {
      const { confirmed, name: branchName } =
        await this.interaction.confirmBranch(plan.branchName)

      if (confirmed) {
        await this.workflow.createNewBranch(branchName)
        console.log(`🌿 Created and switched to branch: ${branchName}`)
      }
    }

    const finalCommits = await this.interaction.reviewCommits(plan.commits)

    if (!finalCommits.length) {
      console.log('❌ No commits to execute.')
      throw new Error('No commits to execute.')
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
