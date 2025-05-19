export interface GitService {
  getModifiedFiles(): Promise<string[]>
  getDiff(filePath: string): Promise<string>
  createBranch(name: string): Promise<void>
  commit(message: string): Promise<void>
  push(): Promise<void>
}
