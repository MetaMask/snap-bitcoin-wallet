/**
 * Executes the given promise callback on the data in batches.
 *
 * @param datas - An array of data to be processed in batches.
 * @param callback - A promise callback to be executed on each item of the array.
 * @param batchSize - The size of the batch operation, default is 50.
 * @returns A promise that resolves when all batches have been processed.
 */
export async function processBatch<Data>(
  datas: Data[],
  callback: (item: Data) => Promise<void>,
  batchSize = 50,
): Promise<void> {
  let from = 0;
  let to = batchSize;
  while (from < datas.length) {
    const batch: Promise<void>[] = [];
    for (let i = from; i < Math.min(to, datas.length); i++) {
      batch.push(callback(datas[i]));
    }
    await Promise.all(batch);
    from += batchSize;
    to += batchSize;
  }
}
