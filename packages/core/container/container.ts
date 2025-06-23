import { EventEmitter } from 'node:events'
import type { ClassConstructor } from './types'
import type { ServiceMetadata, Scope, ParamInfo } from './metadata-registry'

export class Container extends EventEmitter {
  private services = new Map<any, ServiceMetadata>()
  private aliases = new Map<any, ClassConstructor>()
  private instances = new Map<any, any>()
  private resolutionStack = new Set<any>()

  /**
   * Registra una clase en el contenedor junto con sus dependencias.
   */
  register<T>(
    constructor: ClassConstructor<T>,
    scope: Scope = 'singleton',
    autorun = false,
    params: ParamInfo[] = [],
  ): void {
    if (this.services.has(constructor)) return

    this.services.set(constructor, { constructor, scope, autorun, params })
    this.emit('registered', { name: constructor.name, constructor })
  }

  registerAlias(abstractKey: any, concreteClass: ClassConstructor): void {
    this.aliases.set(abstractKey, concreteClass)
  }

  private resolveToken(token: any): ClassConstructor | null {
    if (this.services.has(token)) return token
    return this.aliases.get(token) ?? null
  }

  resolve<T>(constructor: ClassConstructor<T>): T {
    if (this.resolutionStack.has(constructor)) {
      throw new Error(
        `Cyclic dependency detected for type: ${constructor.name}`,
      )
    }

    const metadata = this.services.get(constructor)
    if (!metadata) {
      throw new Error(`No service registered for type: ${constructor.name}`)
    }

    if (metadata.scope === 'singleton' && this.instances.has(constructor)) {
      return this.instances.get(constructor)
    }

    this.resolutionStack.add(constructor)

    try {
      const args: any[] = []

      for (let i = 0; i < metadata.params.length; i++) {
        const param = metadata.params[i]

        if (!param?.type) {
          args[i] = undefined
          continue
        }

        const resolvedConstructor = this.resolveToken(param.type)

        if (!resolvedConstructor) {
          if (param.optional) {
            const fallback =
              typeof param.fallback === 'function'
                ? param.fallback()
                : param.fallback
            args[i] = fallback
            continue
          }

          throw new Error(
            `Missing required dependency '${param.type?.name}' for '${constructor.name}' at index ${param.index}`,
          )
        }

        args[i] = this.resolve(resolvedConstructor)
      }

      const instance = new metadata.constructor(...args)

      if (metadata.scope === 'singleton') {
        this.instances.set(constructor, instance)
      }

      this.emit('resolved', { name: constructor.name, instance })
      return instance
    } finally {
      this.resolutionStack.delete(constructor)
    }
  }

  get<T>(constructor: ClassConstructor<T>): T {
    return this.resolve(constructor)
  }

  getAllServices(): any[] {
    return Array.from(this.instances.values())
  }

  clear(): void {
    this.services.clear()
    this.aliases.clear()
    this.instances.clear()
    this.resolutionStack.clear()
  }
}

// Instancia compartida por defecto (opcional)
export const container = new Container()
