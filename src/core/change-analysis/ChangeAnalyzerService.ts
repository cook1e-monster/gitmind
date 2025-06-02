import { $ } from "bun";
import { existsSync } from "node:fs";

export type ChangeType = "MODIFIED" | "CREATED" | "DELETED" | "RENAMED";

export interface FileChange {
	path: string;
	type: ChangeType;
	diff?: string;
	isBinary?: boolean;
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class ChangeAnalyzerService {
	static async analyze(): Promise<FileChange[]> {
		const result = await $`git status --porcelain=1 -z`.quiet();
		const entries = result.stdout.toString().split("\0").filter(Boolean);

		const changes: FileChange[] = [];
		for (const entry of entries) {
			const status = entry.slice(0, 2).trim();
			const paths = entry.slice(3).split(" -> ");
			const path = paths.at(-1)?.trim() ?? "";

			const indexStatus = status[0];
			const workTreeStatus = status[1];

			let type: ChangeType;
			if (status === "??") type = "CREATED";
			else if (indexStatus === "A") type = "CREATED";
			else if (indexStatus === "D" || workTreeStatus === "D") type = "DELETED";
			else if (indexStatus === "R") type = "RENAMED";
			else type = "MODIFIED";

			let diff = "";
			let isBinary = false;

			if ((type === "MODIFIED" || type === "RENAMED") && existsSync(path)) {
				try {
					const diffResult = await $`git diff ${path}`;
					diff = diffResult.stdout.toString();
					isBinary = diff.includes("Binary files");
				} catch {}
			}

			changes.push({ path, type, diff, isBinary });
		}
		return changes;
	}
}
