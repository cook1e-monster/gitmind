import pino, { type BaseLogger, type LoggerOptions, type Level } from 'pino'
import pretty from 'pino-pretty'
// import { createWriteStream } from './pino-papertrail-transport'

export class PinoLogger {
  private readonly logger: BaseLogger

  constructor(level: Level = 'debug') {
    const transport =
      // process.env.NODE_ENV === 'production'
      //   ? createWriteStream({
      //       host: 'logs3.papertrailapp.com',
      //       port: '31140',
      //       environment: process.env.DEPLOY_MODE,
      //       appname: process.env.APP_TYPE,
      //     })
      //   :
      pretty({
        colorize: true,
        colorizeObjects: true,
      })

    const options: LoggerOptions = { level }
    this.logger = pino(options, transport)

    // Return a proxy to preserve `logger.info('message', meta)` format
    return new Proxy(this, {
      get: (target, prop: string) => {
        // Access real methods (e.g., .child(), .level) from the Logger instance
        if (typeof target[prop as keyof PinoLogger] !== 'undefined') {
          return target[prop as keyof PinoLogger]
        }

        // Intercept log levels (info, warn, error, etc.)
        return (message: string, meta?: Record<string, unknown>) => {
          const level = prop as Level
          const method = (target.logger as any)[level]

          if (typeof method !== 'function') {
            throw new Error(`Invalid log level: ${level}`)
          }

          return typeof message === 'string'
            ? method.call(target.logger, meta, message)
            : method.call(target.logger, message)
        }
      },
    })
  }

  // Example for accessing the internal logger directly (optional)
  public getRawLogger(): BaseLogger {
    return this.logger
  }

  // Optional utility to create a child logger with context
  public child(bindings: Record<string, any>): BaseLogger {
    return this.logger.child(bindings)
  }
}
