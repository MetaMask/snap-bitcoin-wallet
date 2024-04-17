export type StaticImplements<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Inter extends new (...args: any[]) => any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Cls extends Inter,
> = InstanceType<Inter>;
