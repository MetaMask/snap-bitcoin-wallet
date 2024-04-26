/**
 * Method to execute the given promise callback by the size of the data in batch operation.
 *
 * @param arr - Array of data to be processed in batch.
 * @param callback - Promise callback to be executed on each item of the array.
 * @param batchSize - Size of the batch operation, default is 50.
 */
export async function processBatch<Data>(
  arr: Data[],
  callback: (item: Data) => Promise<void>,
  batchSize = 50,
): Promise<void> {
  let from = 0;
  let to = batchSize;
  while (from < arr.length) {
    const batch: Promise<void>[] = [];
    for (let i = from; i < Math.min(to, arr.length); i++) {
      batch.push(callback(arr[i]));
    }
    await Promise.all(batch);
    from += batchSize;
    to += batchSize;
  }
}
