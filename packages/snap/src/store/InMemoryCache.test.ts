import { InMemoryCache } from './InMemoryCache';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('set and get', () => {
    it('stores and retrieves a value', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');

      expect(result).toBe('value1');
    });

    it('stores and retrieves complex objects', async () => {
      const complexObject = {
        nested: { data: [1, 2, 3] },
        string: 'test',
        number: 42,
      };

      await cache.set('complex', complexObject);
      const result = await cache.get('complex');

      expect(result).toStrictEqual(complexObject);
    });

    it('stores null values', async () => {
      await cache.set('null-key', null);
      const result = await cache.get('null-key');

      expect(result).toBeNull();
    });

    it('returns undefined for non-existent keys', async () => {
      const result = await cache.get('non-existent');

      expect(result).toBeUndefined();
    });

    it('overwrites existing values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key1', 'value2');
      const result = await cache.get('key1');

      expect(result).toBe('value2');
    });
  });

  describe('TTL (Time To Live)', () => {
    it('stores value with custom TTL', async () => {
      await cache.set('key1', 'value1', 1000);
      const result = await cache.get('key1');

      expect(result).toBe('value1');
    });

    it('expires value after TTL', async () => {
      jest.useFakeTimers();
      const ttl = 1000;

      await cache.set('key1', 'value1', ttl);

      // Before expiration
      expect(await cache.get('key1')).toBe('value1');

      // After expiration
      jest.advanceTimersByTime(ttl + 1);
      expect(await cache.get('key1')).toBeUndefined();
    });

    it('uses default TTL when not specified', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');

      expect(result).toBe('value1');
    });

    it('throws error for negative TTL', async () => {
      await expect(cache.set('key1', 'value1', -100)).rejects.toThrow(
        'TTL must be positive',
      );
    });

    it('throws error for non-numeric TTL', async () => {
      await expect(
        cache.set('key1', 'value1', 'invalid' as any),
      ).rejects.toThrow('TTL must be a number');
    });

    it('throws error for TTL greater than MAX_SAFE_INTEGER', async () => {
      await expect(
        cache.set('key1', 'value1', Number.MAX_SAFE_INTEGER + 1),
      ).rejects.toThrow('TTL must be less than 2^53 - 1');
    });

    it('handles TTL of zero', async () => {
      jest.useFakeTimers();

      await cache.set('key1', 'value1', 0);

      // Should be immediately expired
      jest.advanceTimersByTime(1);
      expect(await cache.get('key1')).toBeUndefined();
    });

    it('clamps TTL to MAX_SAFE_INTEGER to prevent overflow', async () => {
      const largeButValidTTL = Number.MAX_SAFE_INTEGER;
      await cache.set('key1', 'value1', largeButValidTTL);
      const result = await cache.get('key1');

      expect(result).toBe('value1');
    });
  });

  describe('delete', () => {
    it('deletes an existing key', async () => {
      await cache.set('key1', 'value1');
      const deleted = await cache.delete('key1');

      expect(deleted).toBe(true);
      expect(await cache.get('key1')).toBeUndefined();
    });

    it('returns false when deleting non-existent key', async () => {
      const deleted = await cache.delete('non-existent');

      expect(deleted).toBe(false);
    });
  });

  describe('has', () => {
    it('returns true for existing keys', async () => {
      await cache.set('key1', 'value1');

      expect(await cache.has('key1')).toBe(true);
    });

    it('returns false for non-existent keys', async () => {
      expect(await cache.has('non-existent')).toBe(false);
    });

    it('returns false and removes expired keys', async () => {
      jest.useFakeTimers();
      await cache.set('key1', 'value1', 1000);

      expect(await cache.has('key1')).toBe(true);

      jest.advanceTimersByTime(1001);

      expect(await cache.has('key1')).toBe(false);
      // Verify the key was actually removed
      expect(await cache.get('key1')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('removes all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      await cache.clear();

      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
      expect(await cache.get('key3')).toBeUndefined();
      expect(await cache.size()).toBe(0);
    });

    it('works on empty cache', async () => {
      await cache.clear();
      expect(await cache.size()).toBe(0);
    });
  });

  describe('keys', () => {
    it('returns all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const keys = await cache.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('returns empty array for empty cache', async () => {
      const keys = await cache.keys();

      expect(keys).toStrictEqual([]);
    });

    it('excludes expired keys', async () => {
      jest.useFakeTimers();
      await cache.set('key1', 'value1', 1000);
      await cache.set('key2', 'value2', 2000);
      await cache.set('key3', 'value3', 3000);

      jest.advanceTimersByTime(1500);

      const keys = await cache.keys();

      expect(keys).toHaveLength(2);
      expect(keys).not.toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('size', () => {
    it('returns the number of entries', async () => {
      expect(await cache.size()).toBe(0);

      await cache.set('key1', 'value1');
      expect(await cache.size()).toBe(1);

      await cache.set('key2', 'value2');
      expect(await cache.size()).toBe(2);

      await cache.delete('key1');
      expect(await cache.size()).toBe(1);
    });

    it('excludes expired entries', async () => {
      jest.useFakeTimers();
      await cache.set('key1', 'value1', 1000);
      await cache.set('key2', 'value2', 2000);

      expect(await cache.size()).toBe(2);

      jest.advanceTimersByTime(1500);

      expect(await cache.size()).toBe(1);
    });
  });

  describe('peek', () => {
    it('retrieves value without affecting TTL', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.peek('key1');

      expect(result).toBe('value1');
    });

    it('returns undefined for non-existent keys', async () => {
      const result = await cache.peek('non-existent');

      expect(result).toBeUndefined();
    });

    it('returns undefined and removes expired keys', async () => {
      jest.useFakeTimers();
      await cache.set('key1', 'value1', 1000);

      expect(await cache.peek('key1')).toBe('value1');

      jest.advanceTimersByTime(1001);

      expect(await cache.peek('key1')).toBeUndefined();
      // Verify the key was actually removed
      expect(await cache.get('key1')).toBeUndefined();
    });
  });

  describe('mget', () => {
    it('retrieves multiple values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const result = await cache.mget(['key1', 'key2', 'key3']);

      expect(result).toStrictEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });
    });

    it('returns undefined for non-existent keys', async () => {
      await cache.set('key1', 'value1');

      const result = await cache.mget(['key1', 'key2', 'key3']);

      expect(result).toStrictEqual({
        key1: 'value1',
        key2: undefined,
        key3: undefined,
      });
    });

    it('handles empty key array', async () => {
      const result = await cache.mget([]);

      expect(result).toStrictEqual({});
    });

    it('excludes expired entries', async () => {
      jest.useFakeTimers();
      await cache.set('key1', 'value1', 1000);
      await cache.set('key2', 'value2', 2000);

      jest.advanceTimersByTime(1500);

      const result = await cache.mget(['key1', 'key2']);

      expect(result).toStrictEqual({
        key1: undefined,
        key2: 'value2',
      });
    });
  });

  describe('mset', () => {
    it('stores multiple values', async () => {
      await cache.mset([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 'value3' },
      ]);

      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
      expect(await cache.get('key3')).toBe('value3');
    });

    it('stores multiple values with different TTLs', async () => {
      jest.useFakeTimers();
      await cache.mset([
        { key: 'key1', value: 'value1', ttlMilliseconds: 1000 },
        { key: 'key2', value: 'value2', ttlMilliseconds: 2000 },
      ]);

      jest.advanceTimersByTime(1500);

      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBe('value2');
    });

    it('skips undefined values', async () => {
      await cache.mset([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: undefined },
        { key: 'key3', value: 'value3' },
      ]);

      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBeUndefined();
      expect(await cache.get('key3')).toBe('value3');
      expect(await cache.size()).toBe(2);
    });

    it('stores null values', async () => {
      await cache.mset([{ key: 'key1', value: null }]);

      expect(await cache.get('key1')).toBeNull();
    });

    it('handles empty array', async () => {
      await cache.mset([]);
      expect(await cache.size()).toBe(0);
    });

    it('handles single entry (delegates to set)', async () => {
      await cache.mset([
        { key: 'key1', value: 'value1', ttlMilliseconds: 1000 },
      ]);

      expect(await cache.get('key1')).toBe('value1');
    });

    it('throws error if any TTL is invalid', async () => {
      await expect(
        cache.mset([
          { key: 'key1', value: 'value1', ttlMilliseconds: 1000 },
          { key: 'key2', value: 'value2', ttlMilliseconds: -100 },
        ]),
      ).rejects.toThrow('TTL must be positive');

      // Verify no values were set
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
    });
  });

  describe('mdelete', () => {
    it('deletes multiple keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const result = await cache.mdelete(['key1', 'key2']);

      expect(result).toStrictEqual({
        key1: true,
        key2: true,
      });
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
      expect(await cache.get('key3')).toBe('value3');
    });

    it('returns false for non-existent keys', async () => {
      await cache.set('key1', 'value1');

      const result = await cache.mdelete(['key1', 'key2', 'key3']);

      expect(result).toStrictEqual({
        key1: true,
        key2: false,
        key3: false,
      });
    });

    it('handles empty array', async () => {
      const result = await cache.mdelete([]);

      expect(result).toStrictEqual({});
    });
  });

  describe('edge cases and integration', () => {
    it('handles rapid successive operations', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key1', 'value2');
      await cache.set('key1', 'value3');

      expect(await cache.get('key1')).toBe('value3');
    });

    it('handles large number of entries', async () => {
      const entries = Array.from({ length: 1000 }, (_, i) => ({
        key: `key${i}`,
        value: `value${i}`,
      }));

      await cache.mset(entries);

      expect(await cache.size()).toBe(1000);
      expect(await cache.get('key500')).toBe('value500');
    });

    it('maintains separate entries for similar keys', async () => {
      await cache.set('key', 'value1');
      await cache.set('key1', 'value2');
      await cache.set('key10', 'value3');

      expect(await cache.get('key')).toBe('value1');
      expect(await cache.get('key1')).toBe('value2');
      expect(await cache.get('key10')).toBe('value3');
    });

    it('handles mixed operations with expiration', async () => {
      jest.useFakeTimers();

      await cache.set('key1', 'value1', 1000);
      await cache.set('key2', 'value2', 2000);
      await cache.set('key3', 'value3');

      jest.advanceTimersByTime(1500);

      await cache.delete('key3');
      await cache.set('key4', 'value4');

      expect(await cache.size()).toBe(2); // key2 and key4
      expect(await cache.keys()).toStrictEqual(['key2', 'key4']);
    });

    it('handles special characters in keys', async () => {
      const specialKeys = [
        'key:with:colons',
        'key.with.dots',
        'key-with-dashes',
        'key_with_underscores',
        'key with spaces',
        'key/with/slashes',
      ];

      for (const key of specialKeys) {
        await cache.set(key, `value-${key}`);
      }

      for (const key of specialKeys) {
        expect(await cache.get(key)).toBe(`value-${key}`);
      }
    });

    it('handles bigint values', async () => {
      const bigIntValue = BigInt(9007199254740991);
      await cache.set('bigint', bigIntValue);

      expect(await cache.get('bigint')).toBe(bigIntValue);
    });

    it('handles Uint8Array values', async () => {
      const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);
      await cache.set('uint8array', uint8Array);

      const result = await cache.get('uint8array');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result).toStrictEqual(uint8Array);
    });

    it('handles nested arrays and objects', async () => {
      const complexValue = {
        array: [1, 2, { nested: 'value' }],
        object: { a: 1, b: { c: 2 } },
        mixed: [{ x: 1 }, { y: 2 }],
      };

      await cache.set('complex', complexValue);

      expect(await cache.get('complex')).toStrictEqual(complexValue);
    });
  });
});
