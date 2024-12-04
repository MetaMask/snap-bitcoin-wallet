import type { SerializedFees, Fees } from './bitcoin/chain';
import { DefaultCacheTtl } from './config';
import { Caip2ChainId } from './constants';
import { SnapStateManager, logger, compactError } from './utils';

type ISerializable<Data, SerializeData> = {
  data: Data;
  serializedData: SerializeData;

  serialize(): SerializeData;
  deserialize(serializeData: SerializeData): void;
};

class SerializableFees implements ISerializable<Fees, SerializedFees> {
  serializedData: SerializedFees = {
    fees: [],
    expiration: 0,
  };

  data: Fees = {
    fees: [],
    expiration: 0,
  };

  addFeeRate(key: string, value: number) {
    this.data[key] = BigInt(value);
    this.serializedData[key] = value.toString();
  }

  valueOf() {
    return this.data;
  }

  serialize() {
    return this.serializedData;
  }

  deserialize(serializeData: SerializedFees): void {
    Object.entries(serializeData.fees).forEach(([key, value]) => {
      this.data.fees[key] = {
        type: value.type,
        rate: BigInt(value.rate),
      };
    });
  }
}

export type CacheState = {
  feeRate: Record<Caip2ChainId, CachedValue<SerializableFees>>;
};

export class CachedValue<ValueType> {
  value: ValueType;

  readonly expiredAt: number;

  // Will be expired by default if no `expiredAt` is given.
  constructor(value: ValueType, expiredAt?: number) {
    this.value = value;
    this.expiredAt = expiredAt ?? Date.now() + DefaultCacheTtl;
  }

  isExpired() {
    return this.expiredAt <= Date.now();
  }
}

export class CacheStateManager extends SnapStateManager<CacheState> {
  constructor() {
    super({ encrypted: false });
  }

  protected override async get(): Promise<CacheState> {
    return super.get().then((state: CacheState) => {
      if (!state) {
        // eslint-disable-next-line no-param-reassign
        state = {
          feeRate: {
            [Caip2ChainId.Mainnet]: new CachedValue<SerializableFees>({
              fees: [],
            }),
            [Caip2ChainId.Testnet]: new CachedValue<SerializableFees>({
              fees: [],
            }),
          },
        };
      }

      return state;
    });
  }

  async getFeeRate(scope: Caip2ChainId): Promise<CachedValue<Fees> | null> {
    try {
      const state = await this.get();
      const cachedValue = state.feeRate[scope];
      const fee = {
        ...cachedValue,
        value: {
          fees: cachedValue.value.fees.map((serializedFee) => ({
            ...serializedFee,
            rate: BigInt(serializedFee.rate),
          })),
        },
      };

      return fee;
    } catch (error) {
      logger.warn('Failed to get fee rate', error);
      return null;
    }
  }

  async setFeeRate(scope: Caip2ChainId, value: Fees): Promise<void> {
    try {
      await this.update(async (state: CacheState) => {
        state.feeRate[scope] = {
          value: {
            fees: value.fees.map((serializedFee) => ({
              ...serializedFee,
              rate: serializedFee.rate.toString(),
            })),
          },
          expiration: Date.now() + DefaultCacheTtl,
        };
      });
    } catch (error) {
      throw compactError(error, Error);
    }
  }
}
