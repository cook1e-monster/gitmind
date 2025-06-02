import { FileChange } from "../change-analysis/ChangeAnalyzerService";
import { CommitGroup } from "../commit-planner/CommitPlannerService";
import { writeFile } from "fs/promises";

export class HistoryService {
  static async save(data: { changes: FileChange[]; commitPlan: CommitGroup[] }) {
    const timestamp = new Date().toISOString();
    await writeFile(`.gitmind-history-${timestamp}.json`, JSON.stringify(data, null, 2));
  }
}
