export class CustomError extends Error {
  name!: string;

  constructor(message: string) {
    super(message);

    // set error name as constructor name, make it not enumerable to keep native Error behavior
    // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target#new.target_in_constructors
    // see https://github.com/adriengibrat/ts-custom-error/issues/30
    Object.defineProperty(this, 'name', {
      value: new.target.name,
      enumerable: false,
      configurable: true,
    });

    // fix the extended error prototype chain
    // because typescript __extends implementation can't
    // see https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, new.target.prototype);
    // remove constructor from stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}
