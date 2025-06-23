import type { GitService } from '@git/domain/git.interface'

export interface FileStatus {
  path: string
  status: string
}

export interface FileProcessorService {
  determineChangeType(files: string[]): string
  processDiffs(
    files: FileStatus[],
    gitService: GitService,
  ): Promise<Record<string, string>>
}
