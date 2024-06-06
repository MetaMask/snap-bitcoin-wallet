/**
 * A type that enforces static implementation of a class.
 *
 * @template Inter - An interface that the class must implement.
 * @template Cls - The class that implements the interface.
 * @returns The instance type of the interface.
 */
export type StaticImplements<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Inter extends new (...args: any[]) => any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Cls extends Inter,
> = InstanceType<Inter>;
