import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import type { GitService } from '../domain/git.service'

const execAsync = promisify(exec)

export class BunGitService implements GitService {
  async isGitRepo(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree')
      return true
    } catch {
      return false
    }
  }

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

  async commit(message: string, files?: string[]): Promise<void> {
    if (!message || message.trim().length === 0) {
      throw new Error('Commit message cannot be empty')
    }

    try {
      if (files && files.length > 0) {
        for (const file of files) {
          await execAsync(`git add ${file}`)
        }
      } else {
        await execAsync('git add -A')
      }
      const escapedMessage = message.replace(/"/g, '\\"')
      await execAsync(`git commit -m "${escapedMessage}"`)
      console.log(`✅ Committed: ${message}`)
    } catch (e) {
      console.error('[GitMind] Commit failed', e)
      throw e
    }
  }

  async push(): Promise<void> {
    try {
      // Guardar la rama actual
      const currentBranch = await this.getCurrentBranch()

      // Check if we have any commits
      try {
        execSync('git rev-parse HEAD', { stdio: 'ignore' })
      } catch {
        throw new Error('No commits to push. Please commit your changes first.')
      }

      // Hacer el push
      await execAsync('git push -u origin HEAD')
      console.log('🚀 Push complete')

      // Si estamos en una rama diferente a main/master/dev, volver a la rama anterior
      if (!['main', 'master', 'dev'].includes(currentBranch)) {
        await execAsync(`git checkout ${currentBranch}`)
        console.log(`↩️  Volviendo a la rama: ${currentBranch}`)
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
