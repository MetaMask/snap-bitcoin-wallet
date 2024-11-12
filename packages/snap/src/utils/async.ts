/**
 * Executes the given promise callback on the data in batches.
 *
 * @param dataList - An array of data to be processed in batches.
 * @param callback - A promise callback to be executed on each item of the array.
 * @param batchSize - The size of the batch operation, default is 50.
 * @returns A promise that resolves when all batches have been processed.
 */
export async function processBatch<Data>(
  dataList: Data[],
  callback: (item: Data) => Promise<void>,
  batchSize = 50,
): Promise<void> {
  for (let i = 0; i < dataList.length; i += batchSize) {
    const batch = dataList.slice(i, i + batchSize).map(callback);
    await Promise.all(batch);
  }
}
