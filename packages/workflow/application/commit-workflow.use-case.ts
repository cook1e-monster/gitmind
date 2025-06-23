import { Inject, Injectable } from '@core/container'
import { $ } from 'bun'
import { SummarizeDiffsUseCase } from '@llm/application/summarize-diffs.use-case'
import { PlanCommitsUseCase } from '@commit/application/plan-commits.use-case'
import { FileProcessorServiceImpl } from '@file-processing/infrastructure/file-processor.service'
import { GitService } from '@git/infrastructure/git.service'
import type { GitServiceInterface } from '@git/domain/git.interface'
import { GitHubApiService } from '@git/infrastructure/git-hub-api.service'
import type { Commit } from '@commit/domain/commit-plan'

@Injectable()
export class CommitWorkflowUseCase {
  constructor(
    @Inject(GitService) private git: GitServiceInterface,
    @Inject(SummarizeDiffsUseCase)
    private summarizeDiffs: SummarizeDiffsUseCase,
    @Inject(PlanCommitsUseCase) private planCommits: PlanCommitsUseCase,
    @Inject(GitHubApiService) private github: GitHubApiService,
    @Inject(FileProcessorServiceImpl)
    private fileProcessor: FileProcessorServiceImpl,
  ) {}

  async getChangedFiles(): Promise<{ path: string; status: string }[]> {
    const status = await this.git.getStatusPorcelain()
    return status.filter((f) =>
      ['M', 'A', 'D', 'R', 'AM', 'MM', 'RM', '??'].includes(f.status),
    )
  }

  async generateSummariesAndPlan(
    filesToProcess: string[],
    changed: {
      path: string
      status: string
    }[],
  ) {
    const selectedFileStatuses = changed.filter((f) =>
      filesToProcess.includes(f.path),
    )

    const diffs = await this.fileProcessor.processDiffs(
      selectedFileStatuses,
      this.git,
    )

    if (Object.keys(diffs).length === 0) {
      console.log('ℹ️ No changes detected in selected files.')
      throw new Error('No changes detected in selected files.')
    }

    const summaries = await this.summarizeDiffs.execute(diffs)

    const plan = await this.planCommits.execute(summaries)

    if (!plan.commits.length) {
      console.error('❌ Failed to generate commit plan.')
      throw new Error('Failed to generate commit plan.')
    }

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

    return { plan, summaries }
  }

  async createNewBranch(branchName: string) {
    const currentBranch = await this.git.getCurrentBranch()

    await $`git fetch origin ${currentBranch}`
    await $`git reset --hard origin/${currentBranch}`

    // Create and switch to new branch
    await this.git.createBranch(branchName)
    console.log(`🌿 Created and switched to branch: ${name}`)
  }

  async executeCommits(commits: Commit[]): Promise<void> {
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

  async pushChanges(newBranch?: string): Promise<void> {
    if (newBranch) {
      // Force push if it's a new branch
      await $`git push -u origin HEAD --force`
      console.log('🚀 Pushed to new branch')
    } else {
      await this.git.push()
      console.log('🚀 Pushed to current branch')
    }
  }

  async handlePullRequestCreation(
    title: string,
    body: string,
    currentBranch: string,
    newBranch: string,
  ): Promise<void> {
    return this.github.createPullRequest(title, body, currentBranch, newBranch)
  }
}
