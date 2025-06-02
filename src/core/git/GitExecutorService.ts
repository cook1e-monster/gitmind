import { exec } from "bun";
import { CommitGroup } from "../commit-planner/CommitPlannerService";

export class GitExecutorService {
  static async pullLatest() {
    console.log("📥 Haciendo git pull...");
    const result = await exec("git pull --rebase");
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    console.log(result.stdout.toString());
  }
}
