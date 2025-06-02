import { exec } from "bun";
import { CommitGroup } from "../commit-planner/CommitPlannerService";
import { writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import crypto from "crypto";

export class GitPatchApplier {
  static async applyCommits(groups: CommitGroup[]) {
    for (const group of groups) {
      const patchContent = this.buildPatch(group);
      const tmpFile = join(tmpdir(), `patch-${crypto.randomUUID()}.diff`);
      await writeFile(tmpFile, patchContent);
      const applyResult = await exec(`git apply --cached ${tmpFile}`);
      if (applyResult.exitCode !== 0) {
        console.error("❌ Error al aplicar patch:", applyResult.stderr.toString());
        continue;
      }
      await exec(`git commit -m "${group.message}"`);
    }
  }

  private static buildPatch(group: CommitGroup): string {
    return group.files.map(file => {
      return `diff --git a/${file.path} b/${file.path}
--- a/${file.path}
+++ b/${file.path}
${file.diff}`;
    }).join("\n\n");
  }
}
