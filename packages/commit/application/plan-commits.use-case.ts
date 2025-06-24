import {
  type FileChangeSummary,
  CommitPlan,
  type Commit,
  type FileZone,
} from '../domain/commit-plan'
import type { LLMService } from '@llm/domain/llm.service'
import type { FileProcessorService } from '@file-processing/domain/file-processor.service'
import { Inject, Injectable } from '@core/container'
import { OpenAiService } from '@llm/infrastructure/open-ai.service'
import { FileProcessorServiceImpl } from '@file-processing/infrastructure/file-processor.service'

@Injectable()
export class PlanCommitsUseCase {
  constructor(
    @Inject(OpenAiService) private llmService: LLMService,
    @Inject(FileProcessorServiceImpl)
    private fileProcessor: FileProcessorService,
  ) {}

  private preparePrompt(summaries: FileChangeSummary[]): string {
    return `Given these changes, group them into logical commits. Each commit should have a clear, focused purpose.

          Changes:
          ${summaries.map((s) => `- ${s.file}: ${s.summary}`).join('\n')}

          Return the commits in this format:
          commit1: message1
          files: file1, file2

          commit2: message2
          files: file3, file4

          ...`
  }

  async execute(summaries: FileChangeSummary[]): Promise<CommitPlan> {
    // Group files by type first
    const groupedByType = summaries.reduce(
      (acc, summary) => {
        if (!acc[summary.type]) {
          acc[summary.type] = []
        }
        acc[summary.type].push(summary)
        return acc
      },
      {} as Record<FileChangeSummary['type'], FileChangeSummary[]>,
    )

    const commits: Commit[] = []

    // For each type, let the LLM decide if we should split into multiple commits
    for (const [type, typeSummaries] of Object.entries(groupedByType)) {
      const response = await this.llmService.suggestCommits(typeSummaries)

      const commitGroups = response.split('\n\n').filter(Boolean)

      for (const group of commitGroups) {
        const [message, filesLine] = group.split('\n')

        const files = filesLine
          .replace('files:', '')
          .trim()
          .split(',')
          .map((f) => f.trim())

        commits.push({
          message: message.replace(/^commit\d+:\s*/, ''),
          files,
          type: type as FileChangeSummary['type'],
        })
      }
    }

    // Let the LLM decide if we should create a new branch
    const shouldCreateBranch = commits.some(
      (c) => c.type === 'feat' || c.type === 'fix',
    )

    // If any commit is a feat or fix, we create a branch
    // Otherwise, we just return the commits without a branch
    const branchName = shouldCreateBranch
      ? `gitmind/${commits[0].type}/${Date.now()}`
      : undefined

    return new CommitPlan(commits, branchName)
  }

  async executeWithZones(
    summaries: FileChangeSummary[],
    diffs: Record<string, string>,
  ): Promise<CommitPlan> {
    // Analizar zonas específicas en cada archivo
    const allZones: FileZone[] = []

    for (const summary of summaries) {
      const diff = diffs[summary.file]
      if (diff) {
        const zones = await this.fileProcessor.analyzeFileZones(
          summary.file,
          diff,
        )
        allZones.push(...zones)
      }
    }

    // Si no hay zonas específicas o solo hay una zona por archivo, usar el método original
    if (allZones.length <= summaries.length) {
      return this.execute(summaries)
    }

    // Agrupar zonas por tipo
    const groupedZonesByType = allZones.reduce(
      (acc, zone) => {
        if (!acc[zone.type]) {
          acc[zone.type] = []
        }
        acc[zone.type].push(zone)
        return acc
      },
      {} as Record<FileZone['type'], FileZone[]>,
    )

    const commits: Commit[] = []

    // Para cada tipo, dejar que la IA decida si dividir en múltiples commits
    for (const [type, zones] of Object.entries(groupedZonesByType)) {
      const response = await this.llmService.suggestCommitsFromZones(zones)

      const commitGroups = response.split('\n\n').filter(Boolean)

      for (const group of commitGroups) {
        const lines = group.split('\n')
        const message = lines[0]
        const filesLine = lines[1]
        const zonesLine = lines[2]

        const files = filesLine
          .replace('files:', '')
          .trim()
          .split(',')
          .map((f) => f.trim())

        const zones = zonesLine
          ? zonesLine
              .replace('zones:', '')
              .trim()
              .split(',')
              .map((z) => z.trim())
              .map((zoneStr) => {
                const [file, range] = zoneStr.split(':')
                if (range) {
                  const [start, end] = range.split('-').map(Number)
                  return { file, startLine: start, endLine: end }
                }
                return { file: zoneStr }
              })
          : []

        commits.push({
          message: message.replace(/^commit\d+:\s*/, ''),
          files,
          type: type as FileZone['type'],
          zones: zones.length > 0 ? zones : undefined,
        })
      }
    }

    // Determinar si crear una nueva rama
    const shouldCreateBranch = commits.some(
      (c) => c.type === 'feat' || c.type === 'fix',
    )

    const branchName = shouldCreateBranch
      ? `gitmind/${commits[0].type}/${Date.now()}`
      : undefined

    return new CommitPlan(commits, branchName)
  }
}
