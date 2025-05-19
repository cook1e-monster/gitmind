import { BunGitService } from '../../../src/modules/git/infrastructure/BunGitService'
import { OpenAiService } from '../../../src/modules/llm/infrastructure/OpenAiService'
import { SummarizeDiffsUseCase } from '../../../src/modules/llm/application/SummarizeDiffsUseCase'
import { PlanCommitsUseCase } from '../../../src/modules/commit/application/PlanCommitsUseCase'
import inquirer from 'inquirer'
import slugify from 'slugify'
import { $ } from 'bun'

async function main() {
  const git = new BunGitService()
  const llm = new OpenAiService(process.env.OPENAI_API_KEY!, git)

  if (!(await git.isGitRepo())) {
    console.log('❌ Not a Git repository.')
    return
  }

  const status = await git.getStatusPorcelain()
  const changed = status.filter((f) =>
    ['M', 'A', 'D', 'R', 'AM', 'MM', 'RM', '??'].includes(f.status),
  )

  if (changed.length === 0) {
    console.log('✅ No files with changes detected.')
    return
  }

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
    console.log('❌ No files selected.')
    return
  }

  // Handle "Select All" option
  const filesToProcess = selected.includes('select-all')
    ? changed.map((f) => f.path)
    : selected.filter((f) => f !== 'select-all')

  const diffs: Record<string, string> = {}
  for (const file of filesToProcess) {
    const diff = await git.getDiff(file)
    diffs[file] = diff.trim()
  }

  if (Object.keys(diffs).length === 0) {
    console.log('ℹ️ No changes detected in selected files.')
  }

  const summaries = await new SummarizeDiffsUseCase(llm).execute(diffs)
  const plan = await new PlanCommitsUseCase().execute(summaries)
  const message = plan.messages.join('\n\n')

  if (!message || message.trim().length === 0) {
    console.error('❌ Failed to generate commit message.')
    return
  }

  const currentBranch = await git.getCurrentBranch()
  if (['main', 'master', 'dev'].includes(currentBranch)) {
    const branchSlug = slugify(plan.messages[0].slice(0, 50), {
      lower: true,
      strict: true,
    })
    const newBranch = `gitmind/${branchSlug}`

    // Ensure we're up to date with the main branch
    await $`git fetch origin ${currentBranch}`
    await $`git reset --hard origin/${currentBranch}`

    // Create and switch to new branch
    await git.createBranch(newBranch)
    console.log(`🌿 Created and switched to branch: ${newBranch}`)
  }

  for (const file of filesToProcess) {
    await $`git add ${file}`
  }

  await git.commit(message, filesToProcess)

  // Force push if it's a new branch
  if (['main', 'master', 'dev'].includes(currentBranch)) {
    await $`git push -u origin HEAD --force`
  } else {
    await git.push()
  }

  try {
    await $`gh pr create --fill`
    console.log('📝 Pull request created!')
  } catch (error) {
    if (error instanceof Error && error.message.includes('command not found')) {
      console.warn('⚠️ GitHub CLI (gh) is not installed or not authenticated.')
      console.log('\nTo create a pull request:')
      console.log('1. Install GitHub CLI: https://cli.github.com/')
      console.log('2. Authenticate: gh auth login')
      console.log('3. Create PR: gh pr create')
    } else {
      console.warn(
        '⚠️ Failed to create pull request:',
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  console.log('✅ Commit + push complete.')
}

main()
