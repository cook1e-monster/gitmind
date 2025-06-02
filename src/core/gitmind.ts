// src/core/gitmind.ts
import { ChangeAnalyzerService } from './change-analysis/ChangeAnalyzerService'
import { CommitPlannerService } from './commit-planner/CommitPlannerService'
import { PreviewService } from '../ui/PreviewService'
import { GitExecutorService } from './git/GitExecutorService'
import { GitPatchApplier } from './git/GitPatchApplier'
import { HistoryService } from './history/HistoryService'
import { FragmentAwareChangeAnalyzer } from './change-analysis/FragmentAwareChangeAnalyzer'
import { $ } from 'bun'
import { FileChange } from './change-analysis/ChangeAnalyzerService'

export async function runGitMind() {
  try {
    await $`git rev-parse --is-inside-work-tree`.quiet()
  } catch {
    console.error(
      "❗ Este directorio no es un repositorio Git. Ejecuta 'git init' primero.",
    )
    return
  }

  const changes = await ChangeAnalyzerService.analyze()
  if (changes.length === 0) return

  const { default: inquirer } = await import('inquirer')
  const { fileChoices } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'fileChoices',
      message: '📋 Selecciona los archivos que deseas incluir:',
      choices: changes.map((change: FileChange) => ({
        name: `[${change.type}${change.isBinary ? ' BINARY' : ''}] ${change.path}`,
        value: change,
      })),
    },
  ])

  if (fileChoices.length === 0) return

  const textFiles = fileChoices.filter((fc) => !fc.isBinary)
  const ignoredFiles = fileChoices.filter((fc) => fc.isBinary)

  if (ignoredFiles.length > 0) {
    console.warn('⚠️ Los siguientes archivos fueron ignorados por ser binarios:')
    ignoredFiles.forEach((f) => console.warn(`  - ${f.path}`))
  }

  const fragments = (
    await FragmentAwareChangeAnalyzer.analyze(textFiles.map((fc) => fc.path))
  ).filter((f) => Array.isArray(f.lines))

  const createdWithoutFragments = fileChoices.filter(
    (f) =>
      f.type === 'CREATED' &&
      !f.isBinary &&
      !fragments.some((fr) => fr.path === f.path),
  )

  if (fragments.length === 0 && createdWithoutFragments.length === 0) {
    console.warn(
      '⚠️ No se detectaron fragmentos significativos para los archivos seleccionados.',
    )
    return
  }

  const commitPlan = await CommitPlannerService.planCommits(fileChoices, [
    ...fragments,
    ...createdWithoutFragments.map((f) => ({
      path: f.path,
      hunk: '',
      lines: [],
      context: '',
    })),
  ])

  if (commitPlan.length === 0) return

  const editedPlan = await PreviewService.interactiveEdit(commitPlan)
  const approved = await PreviewService.preview(editedPlan)
  if (!approved) return

  try {
    await GitExecutorService.pullLatest()
  } catch {
    return
  }

  await GitPatchApplier.applyCommits(editedPlan)
  await HistoryService.save({ changes: fileChoices, commitPlan: editedPlan })
}
