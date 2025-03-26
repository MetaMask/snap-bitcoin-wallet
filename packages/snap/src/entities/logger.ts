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
   * @param data - The data to log.
   */
  error(...data: any[]): void;

  /**
   * Logs at the `WARN` level.
   * @param data - The data to log.
   */
  warn(...data: any[]): void;

  /**
   * Logs at the `INFO` level.
   * @param data - The data to log.
   */
  info(...data: any[]): void;

  /**
   * Logs at the `DEBUG` level.
   * @param data - The data to log.
   */
  debug(...data: any[]): void;

  /**
   * Logs at the `TRACE` level.
   * @param data - The data to log.
   */
  trace(...data: any[]): void;
};
