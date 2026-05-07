export const logExecutionTime = (operation: string, start: number): void => {
  const end = Date.now();
  console.log(
    `[PERFORMANCE DEBUG - BITCOIN SNAP] ${operation} took ${
      end - start
    } ms to execute`,
  );
};
