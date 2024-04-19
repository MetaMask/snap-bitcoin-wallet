export class AsyncHelper {
  static async processBatch<Data>(
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
}
