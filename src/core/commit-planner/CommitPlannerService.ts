// src/core/commit-planner/CommitPlannerService.ts
import type { FileChange } from '../change-analysis/ChangeAnalyzerService'
import type { FileFragment } from '../change-analysis/FragmentAwareChangeAnalyzer'
import { createOpenAIClient } from '../llm/OpenAIAdapter'
import { existsSync } from 'fs'

export interface CommitGroup {
  message: string
  files: FileChange[]
}

export class CommitPlannerService {
  static async planCommits(
    fileChoices: FileChange[],
    fragments: FileFragment[],
  ): Promise<CommitGroup[]> {
    const validFragments = fragments.filter(
      (f) => Array.isArray(f.lines) && typeof f.path === 'string',
    )

    const prompt =
      `Agrupa fragmentos de cambios en commits lógicos. Devuelve un array JSON con objetos que tengan 'message' y 'fragments'. Cada fragment debe tener un 'path'.
` +
      validFragments
        .map(
          (f) => `Archivo: ${f.path}
${Array.isArray(f.lines) ? f.lines.join('\n') : ''}
---`,
        )
        .join('\n')

    const openai = createOpenAIClient()
    const res = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = res.choices[0].message.content || '[]'

    let parsed: any[] = []
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      console.error('❌ Error al parsear la respuesta del LLM:', raw)
      return []
    }

    return parsed
      .map((g: any) => {
        const files: FileChange[] = []
        for (const frag of g.fragments) {
          const matchedFragment = fragments.find((f) => f.path === frag.path)
          const originalFile = fileChoices.find((f) => f.path === frag.path)
          if (
            matchedFragment &&
            originalFile &&
            existsSync(originalFile.path)
          ) {
            files.push({
              path: originalFile.path,
              type: originalFile.type,
              diff: Array.isArray(matchedFragment.lines)
                ? matchedFragment.lines.join('\n')
                : '',
            })
          }
        }
        return { message: g.message, files }
      })
      .filter((g) => g.files.length > 0)
  }
}
