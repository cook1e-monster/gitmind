import { BunGitService } from "../../../src/modules/git/infrastructure/BunGitService";
import { OpenAiService } from "../../../src/modules/llm/infrastructure/OpenAiService";
import { SummarizeDiffsUseCase } from "../../../src/modules/llm/application/SummarizeDiffsUseCase";
import { PlanCommitsUseCase } from "../../../src/modules/commit/application/PlanCommitsUseCase";
import inquirer from "inquirer";
import { $ } from "bun";
import { config } from "../../../config";

const OPENAI_API_KEY = config.OPENAI_API_KEY;

// Función para obtener la información del repositorio de Git
async function getGitHubInfo(): Promise<{ owner: string; repo: string }> {
	const remoteUrl = await $`git config --get remote.origin.url`.text();
	const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);

	if (!match) {
		throw new Error("Could not determine GitHub repository from git remote");
	}

	return {
		owner: match[1],
		repo: match[2],
	};
}

// Función para obtener el token de GitHub del sistema
function getGitHubToken(): string {
	// Intentar obtener el token de diferentes fuentes
	const token =
		process.env.GITHUB_TOKEN ||
		process.env.GH_TOKEN ||
		process.env.GITHUB_PAT ||
		process.env.GH_PAT;

	if (!token) {
		throw new Error(
			"GitHub token not found. Please set GITHUB_TOKEN, GH_TOKEN, GITHUB_PAT, or GH_PAT environment variable",
		);
	}

	return token;
}

// Función para determinar el tipo de cambio basado en los archivos modificados
function determineChangeType(files: string[]): string {
	const hasNewFiles = files.some((f) => f.startsWith("A "));
	const hasModifiedFiles = files.some((f) => f.startsWith("M "));
	const hasDeletedFiles = files.some((f) => f.startsWith("D "));

	if (hasNewFiles && !hasModifiedFiles && !hasDeletedFiles) return "feature";
	if (hasDeletedFiles) return "remove";
	if (hasModifiedFiles) return "update";
	return "change";
}

// Función para crear un PR usando la API de GitHub
async function createPullRequest(
	title: string,
	body: string,
	baseBranch: string,
	headBranch: string,
): Promise<void> {
	const { owner, repo } = await getGitHubInfo();
	const token = getGitHubToken();

	const response = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/pulls`,
		{
			method: "POST",
			headers: {
				Authorization: `token ${token}`,
				Accept: "application/vnd.github.v3+json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				title,
				body,
				head: headBranch,
				base: baseBranch,
			}),
		},
	);

	if (!response.ok) {
		const error = await response.json();
		throw new Error(`Failed to create PR: ${error.message}`);
	}
}

async function main() {
	const git = new BunGitService();
	const llm = new OpenAiService(OPENAI_API_KEY!, git);

	if (!(await git.isGitRepo())) {
		console.log("❌ Not a Git repository.");
		return;
	}

	const status = await git.getStatusPorcelain();
	const changed = status.filter((f) =>
		["M", "A", "D", "R", "AM", "MM", "RM", "??"].includes(f.status),
	);

	if (changed.length === 0) {
		console.log("✅ No files with changes detected.");
		return;
	}

	const { selected } = await inquirer.prompt([
		{
			type: "checkbox",
			name: "selected",
			message: "📂 Select files to include in commit:",
			choices: [
				new inquirer.Separator("=== Files with changes ==="),
				...changed.map((f) => ({
					name: `${f.status} ${f.path}`,
					value: f.path,
				})),
				new inquirer.Separator("=== Options ==="),
				{
					name: "📦 Select All Files",
					value: "select-all",
				},
			],
			validate: (input) => {
				if (input.length === 0) {
					return "Please select at least one file to commit";
				}
				return true;
			},
		},
	]);

	if (selected.length === 0) {
		console.log("❌ No files selected.");
		return;
	}

	// Handle "Select All" option
	const filesToProcess = selected.includes("select-all")
		? changed.map((f) => f.path)
		: selected.filter((f) => f !== "select-all");

	const diffs: Record<string, string> = {};
	for (const file of filesToProcess) {
		const fileStatus = changed.find((f) => f.path === file);
		if (fileStatus?.status === "D") {
			diffs[file] = "[Deleted file]"; // Evitar llamar a getDiff
			continue;
		}

		try {
			const diff = await git.getDiff(file);
			diffs[file] = diff.trim();
		} catch (e) {
			console.warn(`⚠️ Failed to get diff for ${file}: ${e}`);
			diffs[file] = "[Diff unavailable due to error]";
		}
	}

	if (Object.keys(diffs).length === 0) {
		console.log("ℹ️ No changes detected in selected files.");
	}

	const summaries = await new SummarizeDiffsUseCase(llm).execute(diffs);
	const plan = await new PlanCommitsUseCase(llm).execute(summaries);

	if (!plan.commits.length) {
		console.error("❌ Failed to generate commit plan.");
		return;
	}

	const currentBranch = await git.getCurrentBranch();
	let newBranch: string | undefined;

	if (plan.branchName) {
		// Ensure we're up to date with the main branch
		await $`git fetch origin ${currentBranch}`;
		await $`git reset --hard origin/${currentBranch}`;

		// Create and switch to new branch
		await git.createBranch(plan.branchName);
		console.log(`🌿 Created and switched to branch: ${plan.branchName}`);
		newBranch = plan.branchName;
	}

	// Execute each commit in sequence
	for (const commit of plan.commits) {
		// Get status of all files before processing
		const status = await git.getStatusPorcelain();

		for (const file of commit.files) {
			const fileStatus = status.find((f) => f.path === file);

			try {
				if (fileStatus?.status === "D") {
					// For deleted files, use git rm
					await $`git rm "${file}"`;
				} else if (fileStatus) {
					// For existing files, use git add
					await $`git add "${file}"`;
				} else {
					console.warn(`⚠️ File ${file} not found in git status, skipping...`);
					continue;
				}
			} catch (e) {
				console.error(`[GitMind] Failed to stage file ${file}:`, e);
				throw new Error(`Failed to stage file ${file}`);
			}
		}

		await git.commit(commit.message, commit.files);
		console.log(`✅ Committed: ${commit.message}`);
	}

	if (newBranch) {
		// Force push if it's a new branch
		await $`git push -u origin HEAD --force`;
	} else {
		await git.push();
	}

	try {
		const title = plan.commits[0].message;
		const body = plan.commits
			.slice(1)
			.map((c) => c.message)
			.join("\n\n");
		if (newBranch) {
			await createPullRequest(title, body, currentBranch, newBranch);
			console.log("📝 Pull request created!");
		}
	} catch (error) {
		if (error instanceof Error) {
			console.warn("⚠️ Failed to create pull request:", error.message);
			console.log("\nTo create a pull request manually:");
			console.log("1. Go to GitHub repository");
			console.log('2. Click "Compare & pull request"');
			console.log("3. Fill in the title and description");
		}
	}

	console.log("✅ All commits and push complete.");

	if (!(await git.isGitRepo())) {
		console.log("❌ Not a Git repository.");
		process.exit(1);
	}

	if (changed.length === 0) {
		console.log("✅ No files with changes detected.");
		process.exit(0);
	}

	if (selected.length === 0) {
		console.log("❌ No files selected.");
		process.exit(1);
	}

	if (Object.keys(diffs).length === 0) {
		console.log("ℹ️ No changes detected in selected files.");
		process.exit(0);
	}

	if (!plan.commits.length) {
		console.error("❌ Failed to generate commit plan.");
		process.exit(1);
	}

	process.exit(0);
}

main();
