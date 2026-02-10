import type { Logger } from '../entities';
import { LogLevel } from '../entities';

const logLevelPriority = {
  [LogLevel.SILENT]: 0,
  [LogLevel.ERROR]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.INFO]: 3,
  [LogLevel.DEBUG]: 4,
  [LogLevel.TRACE]: 5,
};

export class ConsoleLoggerAdapter implements Logger {
  readonly #logLevel: LogLevel;

  constructor(logLevel: LogLevel) {
    this.#logLevel = logLevel;
  }

  #shouldLog(level: LogLevel): boolean {
    return logLevelPriority[level] <= logLevelPriority[this.#logLevel];
  }

  // TODO: Replace `any` with type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(...data: any[]): void {
    if (this.#shouldLog(LogLevel.ERROR)) {
      console.error(...data);
    }
  }

  // TODO: Replace `any` with type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(...data: any[]): void {
    if (this.#shouldLog(LogLevel.WARN)) {
      console.warn(...data);
    }
  }

  // TODO: Replace `any` with type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(...data: any[]): void {
    if (this.#shouldLog(LogLevel.INFO)) {
      console.info(...data);
    }
  }

  // TODO: Replace `any` with type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(...data: any[]): void {
    if (this.#shouldLog(LogLevel.DEBUG)) {
      console.debug(...data);
    }
  }

  // TODO: Replace `any` with type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trace(...data: any[]): void {
    if (this.#shouldLog(LogLevel.TRACE)) {
      console.trace(...data);
    }
  }
}
