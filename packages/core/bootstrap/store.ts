import type { ClassConstructor } from '../container'

interface BootstrapMeta {
  target: ClassConstructor
}

const store: BootstrapMeta[] = []

export function registerBootstrap(meta: BootstrapMeta) {
  store.push(meta)
}

export function getAllBootstraps(): BootstrapMeta[] {
  return store
}

export function clearBootstraps() {
  store.length = 0
}
