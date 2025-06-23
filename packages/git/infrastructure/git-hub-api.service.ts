import { Injectable } from '@core/container'
import { $ } from 'bun'
import type { GitHubService } from '../domain/github.service'

@Injectable()
export class GitHubApiService implements GitHubService {
  getToken(): string {
    // Intentar obtener el token de diferentes fuentes
    const token =
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_PAT ||
      process.env.GH_PAT

    if (!token) {
      throw new Error(
        'GitHub token not found. Please set GITHUB_TOKEN, GH_TOKEN, GITHUB_PAT, or GH_PAT environment variable',
      )
    }

    return token
  }

  async getRepositoryInfo(): Promise<{ owner: string; repo: string }> {
    const remoteUrl = await $`git config --get remote.origin.url`.text()
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)

    if (!match) {
      throw new Error('Could not determine GitHub repository from git remote')
    }

    return {
      owner: match[1],
      repo: match[2],
    }
  }

  async createPullRequest(
    title: string,
    body: string,
    baseBranch: string,
    headBranch: string,
  ): Promise<void> {
    const { owner, repo } = await this.getRepositoryInfo()
    const token = this.getToken()

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          head: headBranch,
          base: baseBranch,
        }),
      },
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to create PR: ${error.message}`)
    }
  }
}
