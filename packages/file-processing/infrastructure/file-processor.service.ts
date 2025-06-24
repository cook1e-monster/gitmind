import { Injectable } from '@core/container'
import type {
  FileProcessorService,
  FileStatus,
  DiffHunk,
} from '../domain/file-processor.service'
import type { GitServiceInterface } from '@git/domain/git.interface'
import type { FileZone } from '@commit/domain/commit-plan'

@Injectable()
export class FileProcessorServiceImpl implements FileProcessorService {
  determineChangeType(files: string[]): string {
    const hasNewFiles = files.some((f) => f.startsWith('A '))
    const hasModifiedFiles = files.some((f) => f.startsWith('M '))
    const hasDeletedFiles = files.some((f) => f.startsWith('D '))

    if (hasNewFiles && !hasModifiedFiles && !hasDeletedFiles) return 'feature'
    if (hasDeletedFiles) return 'remove'
    if (hasModifiedFiles) return 'update'
    return 'change'
  }

  async processDiffs(
    files: FileStatus[],
    gitService: GitServiceInterface,
  ): Promise<Record<string, string>> {
    const diffs: Record<string, string> = {}

    for (const file of files) {
      if (file.status === 'D') {
        diffs[file.path] = '[Deleted file]' // Evitar llamar a getDiff
        continue
      }

      try {
        const diff = await gitService.getDiff(file.path)
        diffs[file.path] = diff.trim()
      } catch (e) {
        console.warn(`⚠️ Failed to get diff for ${file.path}: ${e}`)
        diffs[file.path] = '[Diff unavailable due to error]'
      }
    }

    return diffs
  }

  parseDiffHunks(diff: string): DiffHunk[] {
    const hunks: DiffHunk[] = []
    const lines = diff.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Buscar líneas de hunk (ej: @@ -10,5 +10,6 @@)
      const hunkMatch = line.match(/^@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/)
      if (hunkMatch) {
        const oldStart = parseInt(hunkMatch[1])
        const oldCount = parseInt(hunkMatch[2] || '1')
        const newStart = parseInt(hunkMatch[3])
        const newCount = parseInt(hunkMatch[4] || '1')

        const startLine = Math.min(oldStart, newStart)
        const endLine = Math.max(
          oldStart + oldCount - 1,
          newStart + newCount - 1,
        )

        // Recolectar contenido del hunk
        let content = ''
        let j = i + 1
        while (j < lines.length && !lines[j].startsWith('@@')) {
          content += lines[j] + '\n'
          j++
        }

        // Determinar tipo de cambio
        const hasAdditions = content.includes('+') && !content.startsWith('+')
        const hasDeletions = content.includes('-') && !content.startsWith('-')

        let type: 'added' | 'removed' | 'modified' = 'modified'
        if (hasAdditions && !hasDeletions) type = 'added'
        else if (hasDeletions && !hasAdditions) type = 'removed'

        hunks.push({
          startLine,
          endLine,
          content: content.trim(),
          type,
        })

        i = j - 1 // Continuar desde el final del hunk
      }
    }

    return hunks
  }

  async analyzeFileZones(file: string, diff: string): Promise<FileZone[]> {
    const zones: FileZone[] = []

    if (
      !diff ||
      diff === '[Deleted file]' ||
      diff === '[Diff unavailable due to error]'
    ) {
      // Para archivos nuevos o eliminados, crear una zona para todo el archivo
      const isNewFile = diff === '[Deleted file]' ? false : true
      zones.push({
        file,
        description: isNewFile
          ? `Add new file: ${file}`
          : `Delete file: ${file}`,
        type: isNewFile ? 'feat' : 'chore',
      })
      return zones
    }

    const hunks = this.parseDiffHunks(diff)

    // Agrupar hunks cercanos en zonas lógicas
    const groupedHunks = this.groupHunksByProximity(hunks)

    for (const group of groupedHunks) {
      const startLine = Math.min(...group.map((h) => h.startLine))
      const endLine = Math.max(...group.map((h) => h.endLine))
      const combinedContent = group.map((h) => h.content).join('\n')

      // Determinar el tipo de cambio basado en el contenido
      const type = this.determineZoneType(combinedContent, file)

      // Generar descripción basada en el contenido
      const description = this.generateZoneDescription(
        combinedContent,
        file,
        type,
      )

      zones.push({
        file,
        startLine,
        endLine,
        description,
        type,
      })
    }

    return zones
  }

  private groupHunksByProximity(hunks: DiffHunk[]): DiffHunk[][] {
    if (hunks.length === 0) return []

    const groups: DiffHunk[][] = []
    let currentGroup: DiffHunk[] = [hunks[0]]

    for (let i = 1; i < hunks.length; i++) {
      const currentHunk = hunks[i]
      const lastHunk = currentGroup[currentGroup.length - 1]

      // Si los hunks están muy cerca (menos de 10 líneas de separación), agruparlos
      const distance = currentHunk.startLine - lastHunk.endLine
      if (distance <= 10) {
        currentGroup.push(currentHunk)
      } else {
        groups.push([...currentGroup])
        currentGroup = [currentHunk]
      }
    }

    groups.push(currentGroup)
    return groups
  }

  private determineZoneType(content: string, file: string): FileZone['type'] {
    const lowerContent = content.toLowerCase()
    const lowerFile = file.toLowerCase()

    // Detectar tipos basados en patrones
    if (
      lowerContent.includes('fix') ||
      lowerContent.includes('bug') ||
      lowerContent.includes('error')
    ) {
      return 'fix'
    }

    if (
      lowerContent.includes('feat') ||
      lowerContent.includes('add') ||
      lowerContent.includes('new')
    ) {
      return 'feat'
    }

    if (
      lowerContent.includes('refactor') ||
      lowerContent.includes('clean') ||
      lowerContent.includes('optimize')
    ) {
      return 'refactor'
    }

    if (
      lowerContent.includes('test') ||
      lowerFile.includes('test') ||
      lowerFile.includes('spec')
    ) {
      return 'test'
    }

    if (
      lowerContent.includes('doc') ||
      lowerContent.includes('comment') ||
      lowerFile.includes('readme')
    ) {
      return 'docs'
    }

    return 'chore'
  }

  private generateZoneDescription(
    content: string,
    file: string,
    type: FileZone['type'],
  ): string {
    const lines = content
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))

    if (lines.length === 0) {
      return `Update ${file}`
    }

    // Buscar patrones comunes en las líneas añadidas
    const addedLines = lines.map((line) => line.substring(1)).join(' ')

    if (
      addedLines.includes('function') ||
      addedLines.includes('class') ||
      addedLines.includes('const')
    ) {
      return `Add new functionality in ${file}`
    }

    if (addedLines.includes('import') || addedLines.includes('export')) {
      return `Update imports/exports in ${file}`
    }

    if (addedLines.includes('style') || addedLines.includes('css')) {
      return `Update styling in ${file}`
    }

    return `Update ${file}`
  }
}
