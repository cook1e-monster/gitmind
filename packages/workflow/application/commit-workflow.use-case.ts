import { Inject, Injectable } from '@core/container'
import { $ } from 'bun'
import { InquirerInteractionService } from '@cli-interaction/infrastructure/inquirer-interaction.service'
import { SummarizeDiffsUseCase } from '@llm/application/summarize-diffs.use-case'
import { PlanCommitsUseCase } from '@commit/application/plan-commits.use-case'
import { FileProcessorServiceImpl } from '@file-processing/infrastructure/file-processor.service'
import { GitService } from '@git/infrastructure/git.service'
import type { GitService as GitServiceInterface } from '@git/domain/git.service'
import { GitHubApiService } from '@git/infrastructure/git-hub-api.service'

@Injectable()
export class CommitWorkflowUseCase {
  constructor(
    @Inject(GitService) private git: GitServiceInterface,
    @Inject(InquirerInteractionService)
    private interaction: InquirerInteractionService,
    @Inject(SummarizeDiffsUseCase)
    private summarizeDiffs: SummarizeDiffsUseCase,
    @Inject(PlanCommitsUseCase) private planCommits: PlanCommitsUseCase,
    @Inject(GitHubApiService) private github: GitHubApiService,
    @Inject(FileProcessorServiceImpl)
    private fileProcessor: FileProcessorServiceImpl,
  ) {}

  async execute(): Promise<void> {
    if (!(await this.git.isGitRepo())) {
      console.log('❌ Not a Git repository.')
      throw new Error('Not a Git repository.')
    }

    const status = await this.git.getStatusPorcelain()
    const changed = status.filter((f) =>
      ['M', 'A', 'D', 'R', 'AM', 'MM', 'RM', '??'].includes(f.status),
    )

    if (changed.length === 0) {
      console.log('✅ No files with changes detected.')
      throw new Error('No files with changes detected.')
    }

    // Select files to process
    const filesToProcess = await this.interaction.selectFiles(changed)

    // Process diffs - filter changed files to only include selected ones
    const selectedFileStatuses = changed.filter((f) =>
      filesToProcess.includes(f.path),
    )

    const diffs = await this.fileProcessor.processDiffs(
      selectedFileStatuses,
      this.git,
    )

    if (Object.keys(diffs).length === 0) {
      console.log('ℹ️ No changes detected in selected files.')
      return
    }

    // Generate summaries and commit plan
    const summaries = await this.summarizeDiffs.execute(diffs)
    const plan = await this.planCommits.execute(summaries)

    if (!plan.commits.length) {
      console.error('❌ Failed to generate commit plan.')
      return
    }

    // Show the commit plan to the user
    console.log('\n📋 Generated Commit Plan:')
    console.log('='.repeat(50))

    if (plan.branchName) {
      console.log(`🌿 Suggested branch: ${plan.branchName}`)
    }

    plan.commits.forEach((commit, index) => {
      console.log(`\n${index + 1}. ${commit.message}`)
      console.log(`   Files: ${commit.files.join(', ')}`)
      console.log(`   Type: ${commit.type}`)
    })

    // Handle branch creation
    let newBranch: string | undefined
    const currentBranch = await this.git.getCurrentBranch()

    if (plan.branchName) {
      const { confirmed, name } = await this.interaction.confirmBranch(
        plan.branchName,
      )

      if (confirmed) {
        // Ensure we're up to date with the main branch
        await $`git fetch origin ${currentBranch}`
        await $`git reset --hard origin/${currentBranch}`

        // Create and switch to new branch
        await this.git.createBranch(name)
        console.log(`🌿 Created and switched to branch: ${name}`)
        newBranch = name
      }
    }

    // Review and edit commits
    const finalCommits = await this.interaction.reviewCommits(plan.commits)

    if (finalCommits.length === 0) {
      console.log('❌ No commits to execute.')
      return
    }

    // Confirm execution
    const shouldExecute = await this.interaction.confirmExecution(
      finalCommits.length,
    )
    if (!shouldExecute) {
      console.log('❌ Operation cancelled by user.')
      return
    }

    // Execute commits
    await this.executeCommits(finalCommits)

    // Handle push
    const shouldPush = await this.interaction.confirmPush()
    if (shouldPush) {
      await this.pushChanges(newBranch)
    } else {
      console.log('⏸️ Push skipped by user.')
    }

    // Handle pull request creation
    if (newBranch && shouldPush) {
      await this.handlePullRequestCreation(
        finalCommits,
        currentBranch,
        newBranch,
      )
    }

    console.log('✅ All operations complete.')
  }

  private async executeCommits(commits: any[]): Promise<void> {
    for (const commit of commits) {
      // Get status of all files before processing
      const status = await this.git.getStatusPorcelain()

      for (const file of commit.files) {
        const fileStatus = status.find((f) => f.path === file)

        try {
          // Check if file is already staged (status starts with A, M, or D)
          if (fileStatus && ['A', 'M', 'D'].includes(fileStatus.status)) {
            console.log(`[GitMind] File ${file} is already staged, skipping.`)
            continue
          }

          if (fileStatus?.status === 'D') {
            // For deleted files, use git rm
            await $`git rm "${file}"`
          } else if (fileStatus?.status === '??') {
            // For untracked files, use git add
            await $`git add "${file}"`
          } else if (fileStatus?.status === 'M') {
            // For modified files, use git add
            await $`git add "${file}"`
          } else {
            console.warn(`⚠️ File ${file} not found in git status, skipping...`)
            continue
          }
        } catch (e) {
          console.error(`[GitMind] Failed to stage file ${file}:`, e)
          throw new Error(`Failed to stage file ${file}`)
        }
      }

      // Commit without specifying files parameter since we've already staged them
      await this.git.commit(commit.message)
      console.log(`✅ Committed: ${commit.message}`)
    }
  }

  private async pushChanges(newBranch?: string): Promise<void> {
    if (newBranch) {
      // Force push if it's a new branch
      await $`git push -u origin HEAD --force`
      console.log('🚀 Pushed to new branch')
    } else {
      await this.git.push()
      console.log('🚀 Pushed to current branch')
    }
  }

  private async handlePullRequestCreation(
    commits: any[],
    currentBranch: string,
    newBranch: string,
  ): Promise<void> {
    const { title, body } =
      await this.interaction.createPullRequestData(commits)

    try {
      await this.github.createPullRequest(title, body, currentBranch, newBranch)
      console.log('📝 Pull request created!')
    } catch (error) {
      if (error instanceof Error) {
        console.warn('⚠️ Failed to create pull request:', error.message)
        console.log('\nTo create a pull request manually:')
        console.log('1. Go to GitHub repository')
        console.log('2. Click "Compare & pull request"')
        console.log('3. Fill in the title and description')
      }
    }
  }
}
