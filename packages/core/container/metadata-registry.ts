export type Scope = 'singleton' | 'transient'
export type Fallback = (() => any) | any
import type { ClassConstructor } from '../container'

export interface ParamInfo {
  index: number
  type?: any
  optional?: boolean
  fallback?: Fallback
}

export interface ServiceMetadata {
  constructor: ClassConstructor
  scope: Scope
  autorun: boolean
  params: ParamInfo[]
}

interface InternalServiceMeta {
  scope: Scope
  autorun: boolean
}

class MetadataRegistry {
  private services = new Map<ClassConstructor, InternalServiceMeta>()
  private paramMap = new Map<ClassConstructor, ParamInfo[]>()

  registerService(ctor: ClassConstructor, scope: Scope, autorun: boolean) {
    this.services.set(ctor, { scope, autorun })
  }

  registerParamType(target: ClassConstructor, index: number, type: any) {
    const list = this.paramMap.get(target) || []
    list[index] = { ...list[index], index, type }
    this.paramMap.set(target, list)
  }

  registerParamOptional(
    target: ClassConstructor,
    index: number,
    fallback?: Fallback,
  ) {
    const list = this.paramMap.get(target) || []
    list[index] = { ...list[index], index, optional: true, fallback }
    this.paramMap.set(target, list)
  }

  getAllMetadata() {
    return Array.from(this.services.entries()).map(([ctor, meta]) => ({
      constructor: ctor,
      scope: meta.scope,
      autorun: meta.autorun,
      params: this.paramMap.get(ctor) || [],
    }))
  }
}

// ✅ Exporta la instancia final aquí:
export const metadataRegistry = new MetadataRegistry()
