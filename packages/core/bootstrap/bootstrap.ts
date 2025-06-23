// packages/di/bootstrap/app-bootstrap.service.ts

import path from 'path'
import { fileURLToPath } from 'url'
import { container as defaultContainer } from '../container'
import { AutoLoader } from './auto-loader'
import { metadataRegistry } from '../container/metadata-registry'
import type { Container } from '../container'
import { BootstrapBase } from './bootstrap-base'
import { getAllBootstraps, registerBootstrap } from './store'

interface BootstrapOptions {
  rootDir?: string
  extraDirs?: string[]
  container?: Container
  logger?: {
    debug?: (msg: string) => void
    info?: (msg: string) => void
    warn?: (msg: string) => void
    error?: (msg: string) => void
  }
}

export class BootstrapService {
  static async init(
    callerMetaUrl?: string,
    options: BootstrapOptions = {},
  ): Promise<Container> {
    // 1. Resolver rootDir si no se dio
    const rootDir =
      options.rootDir || path.dirname(fileURLToPath(callerMetaUrl))

    const extraDirs = options.extraDirs ?? [
      path.resolve(process.cwd(), 'packages'),
    ]

    const container = options.container ?? defaultContainer
    const logger = options.logger ?? console

    // 2. Cargar archivos con AutoLoader
    logger.debug?.(`📦 Auto-loading files from: ${rootDir}`)

    await AutoLoader.init({ rootDir, extraDirs })

    // 3. Registrar servicios
    logger.debug?.('🔧 Registering injectable services...')
    for (const meta of metadataRegistry.getAllMetadata()) {
      // register as autorun service
      if (meta.constructor.prototype instanceof BootstrapBase) {
        registerBootstrap({ target: meta.constructor })
      }

      container.register(
        meta.constructor,
        meta.scope,
        meta.autorun,
        meta.params,
      )
    }

    // startup services
    for (const meta of getAllBootstraps()) {
      const instance = container.get(meta.target)

      if (
        instance instanceof BootstrapBase &&
        typeof instance.bootstrap === 'function'
      ) {
        try {
          await instance.bootstrap()
        } catch (err) {
          logger.error?.(`❌ Error in ${meta.target.name}.bootstrap(): ${err}`)
        }
      }
    }

    return container
  }
}
