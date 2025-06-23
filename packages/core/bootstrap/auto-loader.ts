// packages/di/auto-loader.ts

import { glob } from 'glob'
import path from 'path'

interface AutoLoaderOptions {
  rootDir: string // obligatorio: raíz de la app (apps/app1)
  extraDirs?: string[] // opcional: paths adicionales como 'packages'
}

export class AutoLoader {
  private static options: AutoLoaderOptions | null = null

  private static readonly ignorePatterns = [
    '**/*.spec.{ts,js}',
    '**/*.test.{ts,js}',
    '**/__test__/**',
    '**/__tests__/**',
    '**/node_modules/**',
    '**/auto-load/**',
    '**/create-app/**',
  ]

  static async init(options: AutoLoaderOptions): Promise<void> {
    this.options = options
    await this.loadCoreFiles()
    await this.loadApplicationFiles()
    // await this.runAutoRunMethods()
  }

  private static async loadCoreFiles(): Promise<void> {
    const corePattern = path.resolve(__dirname, '../*.{ts,js}')
    await this.importMatchingFiles(corePattern)
  }

  private static async loadApplicationFiles(): Promise<void> {
    if (!this.options) throw new Error('Missing AutoLoader options')

    const { rootDir, extraDirs = [] } = this.options
    const allowedDirs = [rootDir, ...extraDirs]

    for (const dir of allowedDirs) {
      const pattern = path.resolve(dir, '**/*.{ts,js}')
      await this.importMatchingFiles(pattern, allowedDirs)
    }
  }

  private static async importMatchingFiles(
    pattern: string,
    allowedDirs?: string[],
  ): Promise<void> {
    const files = await glob(pattern, {
      ignore: this.ignorePatterns,
      nodir: true,
    })

    for (const file of files) {
      const resolvedPath = path.resolve(file)

      // Si hay directorios permitidos, filtramos
      if (allowedDirs && !this.isInsideAllowedDirs(resolvedPath, allowedDirs)) {
        console.debug(`🚫 Skipped: ${resolvedPath}`)
        continue
      }

      try {
        await import(resolvedPath)
        // console.debug(`📦 Imported: ${resolvedPath}`)
      } catch (err) {
        console.warn(`⚠️ Failed to import ${resolvedPath}: ${err}`)
      }
    }
  }

  private static isInsideAllowedDirs(
    filePath: string,
    allowedDirs: string[],
  ): boolean {
    const normalizedFile = path.normalize(filePath)
    return allowedDirs.some((dir) =>
      normalizedFile.startsWith(path.normalize(dir)),
    )
  }

  // private static async runAutoRunMethods(): Promise<void> {
  //   if (!this.container) {
  //     console.warn('⚠️ No container set. Skipping autorun services.')
  //     return
  //   }

  //   const services = this.container.getAllServicesWithAutorun()

  //   for (const Service of services) {
  //     const instance = this.container.get(Service)
  //     if (typeof instance.autorun === 'function') {
  //       console.info(`⚙️ Running autorun => ${Service.name}`)
  //       try {
  //         await instance.autorun()
  //       } catch (err) {
  //         console.error(`❌ autorun failed for ${Service.name}:`, err)
  //       }
  //     }
  //   }
  // }
}
