import { $ } from 'bun'
import type { GitService } from '../domain/git.service'

export class BunGitService implements GitService {
  async isGitRepo(): Promise<boolean> {
    try {
      await $`git rev-parse --is-inside-work-tree`.quiet()
      return true
    } catch {
      return false
    }
  }

  async getStatusPorcelain(): Promise<{ path: string; status: string }[]> {
    try {
      const raw = await $`git status --porcelain`.text()
      return raw
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
      await $`git checkout -b ${name}`
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

      const result = await $`git diff -- ${filePath}`.text()
      return result.trim()
    } catch (e) {
      console.error(`[GitMind] Diff failed for ${filePath}`, e)
      return ''
    }
  }

  async commit(message: string, files?: string[]): Promise<void> {
    if (!message || message.trim().length === 0) {
      throw new Error('Commit message cannot be empty')
    }

    try {
      if (files && files.length > 0) {
        for (const file of files) {
          await $`git add ${file}`
        }
      } else {
        await $`git add -A`
      }
      const escapedMessage = message.replace(/"/g, '\\"')
      await $`git commit -m "${escapedMessage}"`
      console.log(`✅ Committed: ${message}`)
    } catch (e) {
      console.error('[GitMind] Commit failed', e)
      throw e
    }
  }

  async push(): Promise<void> {
    try {
      // Check if we have any commits
      const hasCommits = await $`git rev-parse HEAD`
        .quiet()
        .then(() => true)
        .catch(() => false)
      if (!hasCommits) {
        throw new Error('No commits to push. Please commit your changes first.')
      }
      await $`git push -u origin HEAD`
      console.log('🚀 Push complete')
    } catch (e) {
      console.error('[GitMind] Push failed', e)
      throw e
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      return (await $`git rev-parse --abbrev-ref HEAD`.text()).trim()
    } catch {
      return 'unknown'
    }
  }
}
