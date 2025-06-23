import { metadataRegistry } from '../metadata-registry'

export function Inject(token: any): ParameterDecorator {
  return (target, _propertyKey, index) => {
    metadataRegistry.registerParamType(target as any, index, token)
  }
}
