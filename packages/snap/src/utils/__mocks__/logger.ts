export class Logger {
  log = jest.fn();

  warn = jest.fn();

  error = jest.fn();

  debug = jest.fn();

  info = jest.fn();

  trace = jest.fn();

  logLevel = 0;
}

export const logger = new Logger();
