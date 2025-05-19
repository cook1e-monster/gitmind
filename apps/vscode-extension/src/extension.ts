import * as vscode from 'vscode'
import { SummarizeDiffsUseCase } from '../../../src/modules/llm/application/SummarizeDiffsUseCase'
import { PlanCommitsUseCase } from '../../../src/modules/commit/application/PlanCommitsUseCase'
import { BunGitService } from '../../../src/modules/git/infrastructure/BunGitService'
import { OpenAiService } from '../../../src/modules/llm/infrastructure/OpenAiService'

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

      const git = new BunGitService()
      const llm = new OpenAiService(apiKey)
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

      const summaries = await new SummarizeDiffsUseCase(llm).execute(diffs)
      const plan = await new PlanCommitsUseCase().execute(summaries)

      viewProvider.updateSuggestedCommits(plan.messages)
    },
  )

  context.subscriptions.push(panelCommand)
}

// biome-ignore lint/suspicious/noEmptyBlockStatements: <explanation>
export function deactivate() {}
