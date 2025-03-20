import type { Logger } from '../entities';
import { LogLevel } from '../entities';

const logLevelPriority = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
  [LogLevel.TRACE]: 4,
};

export class ConsoleLoggerAdapter implements Logger {
  readonly #logLevel: LogLevel;

  constructor(logLevel: LogLevel) {
    this.#logLevel = logLevel;
  }

  #shouldLog(level: LogLevel): boolean {
    return logLevelPriority[level] <= logLevelPriority[this.#logLevel];
  }

  error(...data: any[]): void {
    if (this.#shouldLog(LogLevel.ERROR)) {
      console.error(...data);
    }
  }

  warn(...data: any[]): void {
    if (this.#shouldLog(LogLevel.WARN)) {
      console.warn(...data);
    }
  }

  info(...data: any[]): void {
    if (this.#shouldLog(LogLevel.INFO)) {
      console.info(...data);
    }
  }

  debug(...data: any[]): void {
    if (this.#shouldLog(LogLevel.DEBUG)) {
      console.debug(...data);
    }
  }

  trace(...data: any[]): void {
    if (this.#shouldLog(LogLevel.TRACE)) {
      console.trace(...data);
    }
  }
}
