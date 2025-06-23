import { Injectable } from '@core/container'
import type {
  FileProcessorService,
  FileStatus,
} from '../domain/file-processor.service'
import type { GitService } from '@git/domain/git.service'

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
    gitService: GitService,
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
}
