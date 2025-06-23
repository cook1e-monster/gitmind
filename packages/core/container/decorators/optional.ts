import { metadataRegistry } from '../metadata-registry'

export function Optional(fallback?: (() => any) | any): ParameterDecorator {
  return (target, _propertyKey, index) => {
    metadataRegistry.registerParamOptional(target as any, index, fallback)
  }
}
