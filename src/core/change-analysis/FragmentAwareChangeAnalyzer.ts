import { $ } from "bun";

export interface FileFragment {
	path: string;
	hunk: string;
	lines: string[];
	context: string;
}

export class FragmentAwareChangeAnalyzer {
	static async analyze(paths?: string[]): Promise<FileFragment[]> {
		const files =
			paths ??
			(await $`git diff --name-only`.quiet()).stdout
				.toString()
				.trim()
				.split("\n")
				.filter(Boolean);

		const fragments: FileFragment[] = [];

		for (const path of files) {
			const diffResult = await $`git diff -U0 ${path}`.quiet();
			const diffLines = diffResult.stdout.toString().split("\n");

			let hunkHeader = "";
			let currentHunk: string[] = [];

			for (const line of diffLines) {
				if (line.startsWith("@@")) {
					if (currentHunk.length > 0) {
						fragments.push({
							path,
							hunk: hunkHeader,
							lines: currentHunk,
							context: "",
						});
					}
					hunkHeader = line;
					currentHunk = [];
				} else if (line.startsWith("+") || line.startsWith("-")) {
					currentHunk.push(line);
				}
			}
			if (currentHunk.length > 0) {
				fragments.push({
					path,
					hunk: hunkHeader,
					lines: currentHunk,
					context: "",
				});
			}
		}
		return fragments;
	}
}
