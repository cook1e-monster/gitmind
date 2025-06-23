import { BootstrapService } from '@core/bootstrap'
import { Cli } from './cli'

const container = await BootstrapService.init(import.meta.url)

const cli = container.get(Cli)

cli.start()
