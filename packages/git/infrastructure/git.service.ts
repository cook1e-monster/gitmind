import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import type { GitServiceInterface } from '../domain/git.interface'
import { Injectable } from '@core/container'

const execAsync = promisify(exec)

@Injectable()
export class GitService implements GitServiceInterface {
  async isGitRepo(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree')
      return true
    } catch {
      return false
    }
  }

  // git status but with porcelain format (short format)
  async getStatusPorcelain(): Promise<{ path: string; status: string }[]> {
    try {
      const { stdout } = await execAsync('git status --porcelain')
      return stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const status = line.slice(0, 2).trim()
          const path = line.slice(3).trim()
          return { path, status }
        })
    } catch (e) {
      console.error('[GitMind] Failed to get status', e)
      return []
    }
  }

  async getModifiedFiles(): Promise<string[]> {
    const all = await this.getStatusPorcelain()
    return all
      .filter((f) => ['M', 'MM', 'AM', 'RM'].includes(f.status))
      .map((f) => f.path)
  }

  async getStagedChanges(): Promise<{ path: string; status: string }[]> {
    const all = await this.getStatusPorcelain()
    return all.filter((f) => ['A', 'M', 'D'].includes(f.status))
  }

  async hasUnstagedChanges(): Promise<boolean> {
    const all = await this.getStatusPorcelain()
    return all.some((f) => f.status === 'M' || f.status === '??')
  }

  async createBranch(name: string): Promise<void> {
    try {
      await execAsync(`git checkout -b ${name}`)
      console.log(`🌿 Created and switched to branch: ${name}`)
    } catch (e) {
      console.error('[GitMind] Failed to create branch', e)
    }
  }

  async getDiff(filePath: string): Promise<string> {
    try {
      // First check if the file has changes
      const status = await this.getStatusPorcelain()
      const fileStatus = status.find((f) => f.path === filePath)

      if (!fileStatus) {
        console.log(`⚠️ File ${filePath} has no changes.`)
        return ''
      }

      const { stdout } = await execAsync(`git diff -- ${filePath}`)
      return stdout.trim()
    } catch (e) {
      console.error(`[GitMind] Diff failed for ${filePath}`, e)
      return ''
    }
  }

  async commit(message: string): Promise<void> {
    if (!message || message.trim().length === 0) {
      throw new Error('Commit message cannot be empty')
    }

    try {
      // Stage all changes since files are already staged in the workflow
      await execAsync('git add -A')

      // Verify that files were staged
      const stagedChanges = await this.getStagedChanges()
      if (stagedChanges.length === 0) {
        throw new Error('No files were staged for commit')
      }

      // Create the commit
      const escapedMessage = message.replace(/"/g, '\\"')
      await execAsync(`git commit -m "${escapedMessage}"`)
    } catch (e) {
      console.error('[GitMind] Commit failed', e)
      throw e
    }
  }

  async push(): Promise<void> {
    try {
      // Save current branch
      const currentBranch = await this.getCurrentBranch()

      // Check if we have any commits
      try {
        execSync('git rev-parse HEAD', { stdio: 'ignore' })
      } catch {
        throw new Error('No commits to push. Please commit your changes first.')
      }

      // Perform push
      await execAsync('git push -u origin HEAD')
      console.log('🚀 Push complete')

      // If we're on a branch other than main/master/dev, return to the previous branch
      if (!['main', 'master', 'dev'].includes(currentBranch)) {
        await execAsync(`git checkout ${currentBranch}`)
        console.log(`↩️  Returning to branch: ${currentBranch}`)
      }
    } catch (e) {
      console.error('[GitMind] Push failed', e)
      throw e
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD')
      return stdout.trim()
    } catch {
      return 'unknown'
    }
  }
}
