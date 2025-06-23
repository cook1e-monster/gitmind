// import type { ClassConstructor } from '../container'
// import { registerBootstrap, type HandlerOptions } from './store'

// export function Autorun(
//   eventType: ClassConstructor,
//   options: HandlerOptions = {},
// ): MethodDecorator {
//   return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
//     const controller = target.constructor as ClassConstructor

//     // Validación opcional en tiempo de ejecución
//     if (
//       typeof eventType !== 'function' ||
//       !(eventType.prototype instanceof Object) ||
//       !Object.getPrototypeOf(eventType.prototype)?.constructor?.name.includes(
//         'DomainEvent',
//       )
//     ) {
//       console.warn(
//         `⚠️ [EventHandler] ${controller.name}.${String(propertyKey)} está intentando registrar un tipo inválido:`,
//         eventType,
//       )
//     }

//     registerBootstrap({
//       target: controller,
//       methodName: propertyKey as string,
//       options,
//     })

//     return descriptor
//   }
// }
