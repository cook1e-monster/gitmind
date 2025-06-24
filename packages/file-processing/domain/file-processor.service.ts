import type { GitService } from '@git/domain/git.interface'
import type { FileZone } from '@commit/domain/commit-plan'

export interface FileStatus {
  path: string
  status: string
}

export interface DiffHunk {
  startLine: number
  endLine: number
  content: string
  type: 'added' | 'removed' | 'modified'
}

export interface FileProcessorService {
  determineChangeType(files: string[]): string
  processDiffs(
    files: FileStatus[],
    gitService: GitService,
  ): Promise<Record<string, string>>
  analyzeFileZones(file: string, diff: string): Promise<FileZone[]>
  parseDiffHunks(diff: string): DiffHunk[]
}
