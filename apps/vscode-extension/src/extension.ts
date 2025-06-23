import * as vscode from 'vscode'
import { SummarizeDiffsUseCase } from '@llm/application/summarize-diffs.use-case'
import { PlanCommitsUseCase } from '@commit/application/plan-commits.use-case'
import { BunGitService } from '@git/infrastructure/git.service'
import { OpenAiService } from '@llm/infrastructure/open-ai.service'

class GitMindViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView
  private _suggestedCommits: string[] = []

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async refresh() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview)
    }
  }

  public updateSuggestedCommits(commits: string[]) {
    this._suggestedCommits = commits
    this.refresh()
  }

  resolveWebviewView(view: vscode.WebviewView) {
    console.log('✅ GitMind panel opened')

    this._view = view
    view.webview.options = { enableScripts: true }
    view.webview.html = this._getHtmlForWebview(view.webview)

    view.onDidChangeVisibility(() => {
      if (view.visible) {
        this.refresh()
      }
    })
  }

  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  private _getHtmlForWebview(webview: vscode.Webview) {
    const commitsHtml =
      this._suggestedCommits.length > 0
        ? this._suggestedCommits
            .map(
              (msg, idx) => `
					<div class="commit-item">
						<p><strong>Commit ${idx + 1}:</strong></p>
						<p>${msg}</p>
						<button onclick="useCommit(${idx})">Use this commit</button>
					</div>
				`,
            )
            .join('')
        : '<p>No suggested commits yet. Run the command <strong>GitMind: Generate Commit with AI</strong> to get started.</p>'

    return `
			<!DOCTYPE html>
			<html>
				<head>
					<style>
						body {
							padding: 10px;
							font-family: var(--vscode-font-family);
							color: var(--vscode-foreground);
						}
						.commit-item {
							margin-bottom: 15px;
							padding: 10px;
							border: 1px solid var(--vscode-panel-border);
							border-radius: 4px;
						}
						button {
							background: var(--vscode-button-background);
							color: var(--vscode-button-foreground);
							border: none;
							padding: 5px 10px;
							border-radius: 2px;
							cursor: pointer;
						}
						button:hover {
							background: var(--vscode-button-hoverBackground);
						}
					</style>
				</head>
				<body>
					<h2>👋 GitMind Assistant</h2>
					${commitsHtml}
					<script>
						const vscode = acquireVsCodeApi();
						function useCommit(index) {
							vscode.postMessage({ type: 'useCommit', index });
						}
					</script>
				</body>
			</html>
		`
  }
}

export async function activate(context: vscode.ExtensionContext) {
  // Initialize DI container
  await BootstrapService.init(import.meta.url)

  const viewProvider = new GitMindViewProvider(context)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gitmindPanel', viewProvider),
  )

  const panelCommand = vscode.commands.registerCommand(
    'gitmind.generateCommit',
    async () => {
      const config = vscode.workspace.getConfiguration('gitmind')
      const apiKey = config.get<string>('openaiApiKey')

      if (!apiKey) {
        vscode.window.showErrorMessage(
          'Please configure your OpenAI API key in the settings (gitmind.openaiApiKey)',
        )
        return
      }

      // Get services from container
      const git = container.get(BunGitService)
      const llm = container.get(OpenAiService)
      const summarizeDiffsUseCase = container.get(SummarizeDiffsUseCase)
      const planCommitsUseCase = container.get(PlanCommitsUseCase)

      const modifiedFiles = await git.getModifiedFiles()

      if (modifiedFiles.length === 0) {
        vscode.window.showInformationMessage('No modified files found.')
        return
      }

      const diffs: Record<string, string> = {}
      for (const file of modifiedFiles) {
        const diff = await git.getDiff(file)
        if (diff.trim()) diffs[file] = diff
      }

      const summaries = await summarizeDiffsUseCase.execute(diffs)
      const plan = await planCommitsUseCase.execute(summaries)

      viewProvider.updateSuggestedCommits(
        plan.commits.map((commit) => commit.message),
      )
    },
  )

  context.subscriptions.push(panelCommand)
}

// biome-ignore lint/suspicious/noEmptyBlockStatements: <explanation>
export function deactivate() {}
