export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
  SILENT = 'silent',
}

/**
 * A Logger.
 */
export type Logger = {
  /**
   * Logs at the `ERROR` level.
   *
   * @param data - The data to log.
   */
  // TODO: Replace `any` with type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(...data: any[]): void;

  /**
   * Logs at the `WARN` level.
   *
   * @param data - The data to log.
   */
  // TODO: Replace `any` with type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(...data: any[]): void;

  /**
   * Logs at the `INFO` level.
   *
   * @param data - The data to log.
   */
  // TODO: Replace `any` with type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(...data: any[]): void;

  /**
   * Logs at the `DEBUG` level.
   *
   * @param data - The data to log.
   */
  // TODO: Replace `any` with type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(...data: any[]): void;

  /**
   * Logs at the `TRACE` level.
   *
   * @param data - The data to log.
   */
  // TODO: Replace `any` with type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trace(...data: any[]): void;
};
