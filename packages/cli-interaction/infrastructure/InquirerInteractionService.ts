import { Injectable } from '@core/container'
import inquirer from 'inquirer'
import type {
  InteractionService,
  FileStatus,
} from '../domain/interaction.service'
import type { Commit } from '@commit/domain/CommitPlan'

@Injectable()
export class InquirerInteractionService implements InteractionService {
  async selectFiles(changed: FileStatus[]): Promise<string[]> {
    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: '📂 Select files to include in commit:',
        choices: [
          new inquirer.Separator('=== Files with changes ==='),
          ...changed.map((f) => ({
            name: `${f.status} ${f.path}`,
            value: f.path,
          })),
          new inquirer.Separator('=== Options ==='),
          {
            name: '📦 Select All Files',
            value: 'select-all',
          },
        ],
        validate: (input) => {
          if (input.length === 0) {
            return 'Please select at least one file to commit'
          }
          return true
        },
      },
    ])

    if (selected.length === 0) {
      throw new Error('No files selected.')
    }

    // Handle "Select All" option
    return selected.includes('select-all')
      ? changed.map((f) => f.path)
      : selected.filter((f: string) => f !== 'select-all')
  }

  async confirmBranch(
    branchName: string,
  ): Promise<{ confirmed: boolean; name: string }> {
    const { confirmBranch } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmBranch',
        message: `Do you want to create a new branch: ${branchName}?`,
        default: true,
      },
    ])

    if (!confirmBranch) {
      return { confirmed: false, name: branchName }
    }

    const { branchName: finalBranchName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'branchName',
        message: 'Enter branch name (or press Enter to use suggested):',
        default: branchName,
      },
    ])

    return { confirmed: true, name: finalBranchName }
  }

  async reviewCommits(commits: Commit[]): Promise<Commit[]> {
    const finalCommits: Commit[] = []

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i]

      console.log(`\n📝 Reviewing commit ${i + 1}/${commits.length}:`)
      console.log(`Message: ${commit.message}`)
      console.log(`Files: ${commit.files.join(', ')}`)
      console.log(`Type: ${commit.type}`)

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do with this commit?',
          choices: [
            { name: '✅ Execute as is', value: 'execute' },
            { name: '✏️ Edit message', value: 'edit' },
            { name: '⏭️ Skip this commit', value: 'skip' },
            { name: '❌ Cancel all', value: 'cancel' },
          ],
        },
      ])

      if (action === 'cancel') {
        throw new Error('Operation cancelled by user.')
      }

      if (action === 'skip') {
        console.log('⏭️ Skipping this commit.')
        continue
      }

      const finalCommit = { ...commit }

      if (action === 'edit') {
        const { message } = await inquirer.prompt([
          {
            type: 'input',
            name: 'message',
            message: 'Enter new commit message:',
            default: commit.message,
          },
        ])
        finalCommit.message = message
      }

      finalCommits.push(finalCommit)
    }

    return finalCommits
  }

  async confirmExecution(commitCount: number): Promise<boolean> {
    const { confirmExecution } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmExecution',
        message: `Execute ${commitCount} commit(s)?`,
        default: true,
      },
    ])

    return confirmExecution
  }

  async confirmPush(): Promise<boolean> {
    const { confirmPush } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmPush',
        message: 'Push changes to remote repository?',
        default: true,
      },
    ])

    return confirmPush
  }

  async createPullRequestData(
    commits: Commit[],
  ): Promise<{ title: string; body: string }> {
    const { prTitle, prBody } = await inquirer.prompt([
      {
        type: 'input',
        name: 'prTitle',
        message: 'Pull request title:',
        default: commits[0].message,
      },
      {
        type: 'editor',
        name: 'prBody',
        message: 'Pull request description:',
        default: commits
          .slice(1)
          .map((c) => c.message)
          .join('\n\n'),
      },
    ])

    return { title: prTitle, body: prBody }
  }
}
