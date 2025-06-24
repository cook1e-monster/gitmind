import { BootstrapService } from './packages/core/bootstrap'
import { PlanCommitsUseCase } from './packages/commit/application/plan-commits.use-case'
import { FileProcessorServiceImpl } from './packages/file-processing/infrastructure/file-processor.service'
import type { FileChangeSummary } from './packages/commit/domain/commit-plan'

async function testZoneAnalysis() {
  // Inicializar el contenedor de dependencias
  await BootstrapService.init(import.meta.url)

  const planCommits = BootstrapService.container.get(PlanCommitsUseCase)
  const fileProcessor = BootstrapService.container.get(FileProcessorServiceImpl)

  // Simular un diff con múltiples cambios en un archivo
  const mockDiff = `diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index 1234567..abcdefg 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,5 +1,10 @@
 import React from 'react'
+import { cn } from '@/lib/utils'
 
+interface ButtonProps {
+  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
+  size?: 'default' | 'sm' | 'lg' | 'icon'
+}
 
 const Button = ({ children, ...props }) => {
   return (
@@ -10,6 +15,15 @@ const Button = ({ children, ...props }) => {
   )
 }
 
+const ButtonVariant = ({ variant = 'default', size = 'default', className, ...props }: ButtonProps) => {
+  return (
+    <button
+      className={cn('button', \`button--\${variant}\`, \`button--\${size}\`, className)}
+      {...props}
+    />
+  )
+}
+
 export default Button
+export { ButtonVariant }
`

  console.log('🔍 Analizando zonas específicas en el archivo...')

  // Analizar zonas específicas
  const zones = await fileProcessor.analyzeFileZones(
    'src/components/Button.tsx',
    mockDiff,
  )

  console.log('\n📋 Zonas detectadas:')
  zones.forEach((zone, index) => {
    const location =
      zone.startLine && zone.endLine
        ? ` (líneas ${zone.startLine}-${zone.endLine})`
        : ''
    console.log(`${index + 1}. ${zone.file}${location}`)
    console.log(`   Descripción: ${zone.description}`)
    console.log(`   Tipo: ${zone.type}`)
  })

  // Simular resúmenes de archivos
  const summaries: FileChangeSummary[] = [
    {
      file: 'src/components/Button.tsx',
      summary: 'Add new Button component with variants',
      type: 'feat',
    },
  ]

  console.log('\n🤖 Generando plan de commits con zonas...')

  // Generar plan de commits usando zonas
  const plan = await planCommits.executeWithZones(summaries, {
    'src/components/Button.tsx': mockDiff,
  })

  console.log('\n📋 Plan de commits generado:')
  plan.commits.forEach((commit, index) => {
    console.log(`\n${index + 1}. ${commit.message}`)
    console.log(`   Archivos: ${commit.files.join(', ')}`)
    console.log(`   Tipo: ${commit.type}`)

    if (commit.zones && commit.zones.length > 0) {
      console.log(`   Zonas:`)
      commit.zones.forEach((zone) => {
        const location =
          zone.startLine && zone.endLine
            ? ` (líneas ${zone.startLine}-${zone.endLine})`
            : ''
        console.log(`     - ${zone.file}${location}: ${zone.description}`)
      })
    }
  })
}

testZoneAnalysis().catch(console.error)
