export abstract class BootstrapBase {
  abstract bootstrap(): Promise<void> | void
}
