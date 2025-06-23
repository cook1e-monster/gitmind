import dgram from 'node:dgram'
import stream from 'node:stream'
import fastJsonParse from 'fast-json-parse'
import split2 from 'split2'
import glossy from 'glossy'
import through2 from 'through2'
import pumpify from 'pumpify'
import stringify from 'fast-safe-stringify'

const PINO_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}
const SYSLOG_SEVERITIES = {
  emergency: '0',
  alert: '1',
  critical: '2',
  error: '3',
  warning: '4',
  notice: '5',
  info: '6',
  debug: '7',
}
const SYSLOG_FACILITIES = {
  kern: 0,
  user: 1,
  mail: 2,
  daemon: 3,
  auth: 4,
  syslog: 5,
  lpr: 6,
  news: 7,
  uucp: 8,
  cron: 9,
  authpriv: 10,
  ftp: 11,
  local0: 16,
  local1: 17,
  local2: 18,
  local3: 19,
  local4: 20,
  local5: 21,
  local6: 22,
  local7: 23,
}

function jsonParser(str: string) {
  const result = fastJsonParse(str)
  if (result.err) return
  return result.value
}

function levelToSeverity(level: number) {
  if (level === PINO_LEVELS.trace || level === PINO_LEVELS.debug) {
    return SYSLOG_SEVERITIES.debug
  }
  if (level === PINO_LEVELS.info) {
    return SYSLOG_SEVERITIES.info
  }
  if (level === PINO_LEVELS.warn) {
    return SYSLOG_SEVERITIES.warning
  }
  if (level === PINO_LEVELS.error) {
    return SYSLOG_SEVERITIES.error
  }
  return SYSLOG_SEVERITIES.critical
}

export function toPapertrailUdp(options: {
  port: number
  host: string
  echo: boolean
  connection: string
}) {
  const socket = dgram.createSocket({ type: 'udp4' })

  return new stream.Writable({
    write(data, _encoding, callback) {
      if (options.echo === true) {
        console.log(data.toString())
      }
      socket.send(
        data,
        0,
        data.length,
        options.port,
        options.host,
        function (err) {
          if (err) {
            console.log('error', err.message)
          }
          callback()
        },
      )
    },
  })
}

export const parseJson = () => {
  return split2(jsonParser)
}

export const toSyslog = (options: {
  appname: string
  environment: string
  facility?: keyof typeof SYSLOG_FACILITIES
}) => {
  const syslogProducer = new glossy.Produce()
  return through2.obj(function (data, _enc, cb) {
    const { level, time, hostname, pid, msg, ...meta } = data
    let host = hostname || 'localhost'
    if (options.appname && options.environment) {
      host = `${options.environment}-${options.appname}`
    }

    const message = syslogProducer.produce({
      facility: options.facility || 'user',
      severity: levelToSeverity(level),
      host,
      appName: options.appname,
      pid,
      time: time ? new Date(time) : new Date(),
      message: Object.keys(meta).length > 0 ? `${msg} ${stringify(meta)}` : msg,
    })

    cb(null, message)
  })
}

type WriteStreamOptions = {
  appname?: string
  echo?: boolean
  host?: string
  port?: string | number
  connection?: 'udp' | 'tcp'
  environment?: string
}

export function createWriteStream(opts: WriteStreamOptions) {
  const defaultOptions = {
    appname: 'pino',
    echo: false,
    host: 'localhost',
    port: '1234',
    connection: 'udp',
    environment: 'local',
  }

  const { appname, environment, echo, host, port, connection } = {
    ...defaultOptions,
    ...opts,
  }

  return pumpify(
    parseJson(),
    toSyslog({ appname, environment }),
    toPapertrailUdp({ echo, port: Number(port), host, connection }),
  )
}
