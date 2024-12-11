import type { Fees, Fee } from './bitcoin/chain';
import { DefaultCacheTtl } from './config';
import { Caip2ChainId } from './constants';
import { SnapStateManager, logger, compactError } from './utils';

export type SerializedFee = Omit<Fee, 'rate'> & {
  rate: string;
};

export type SerializedFees = {
  fees: SerializedFee[];
  expiration: number;
};

type WithExpiration<Value> = Value & { expiration: number };

export type ISerializable<Data, SerializeData> = {
  data: Data;

  serialize(): SerializeData;
  deserialize(serializeData: SerializeData): void;
};

export class SerializableFees
  implements ISerializable<WithExpiration<Fees>, SerializedFees>
{
  data: WithExpiration<Fees> = {
    fees: [],
    expiration: 0,
  };

  constructor(data: Fees = { fees: [] }, expiresIn = DefaultCacheTtl) {
    this.data = {
      fees: data.fees,
      expiration: expiresIn ?? Date.now() + DefaultCacheTtl,
    };
  }

  static fromSerialized(serializeData: SerializedFees): SerializableFees {
    const fees = new SerializableFees();
    fees.deserialize(serializeData);
    return fees;
  }

  valueOf() {
    return this.data;
  }

  serialize() {
    return {
      fees: this.data.fees.map((fee) => ({
        ...fee,
        rate: fee.rate.toString(),
      })),
      expiration: this.data.expiration,
    };
  }

  deserialize(serializeData: SerializedFees): void {
    Object.entries(serializeData.fees).forEach(([key, value]) => {
      const fee = value as { type: string; rate: string };
      this.data.fees[key] = {
        type: fee.type,
        rate: BigInt(fee.rate),
        expiration: serializeData.expiration,
      };
    });
  }
}

export type SerializedCacheState = {
  feeRate: Record<Caip2ChainId, SerializedFees>;
};

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

export class CacheStateManager extends SnapStateManager<SerializedCacheState> {
  constructor() {
    super({ encrypted: false });
  }

  protected override async get(): Promise<SerializedCacheState> {
    return super.get().then((persistedState: SerializedCacheState) => {
      // if (persistedState) {
      //   Object.entries(persistedState.feeRate).forEach(([key, value]) => {
      //     this.#cache.feeRate[key] = new CachedValue(
      //       new SerializableFees().deserialize(value),
      //     );
      //   });
      // } else {
      if (!persistedState) {
        // eslint-disable-next-line no-param-reassign
        persistedState = {
          feeRate: {
            [Caip2ChainId.Mainnet]: {
              fees: [],
              expiration: 0,
            },
            [Caip2ChainId.Testnet]: {
              fees: [],
              expiration: 0,
            },
          },
        };
      }

      // Object.entries(this.#cache.feeRate).forEach(([key, value]) => {
      //   if (value.isExpired()) {
      //     this.#cache.feeRate[key] = new CachedValue(
      //       new SerializableFees({ fees: [] }, 0),
      //     );
      //   } else {
      //     this.#cache.feeRate[key] = new CachedValue(
      //       new SerializableFees(value.value.valueOf(), value.expiredAt),
      //     );
      //   }
      // });

      return persistedState;
    });
  }

  async getFeeRate(
    scope: Caip2ChainId,
  ): Promise<CachedValue<SerializableFees> | null> {
    try {
      const state = await this.get();
      const serializedFee = state.feeRate[scope];
      const fee = new CachedValue(
        SerializableFees.fromSerialized(serializedFee),
        serializedFee.expiration,
      );
      return fee;
    } catch (error) {
      logger.warn('Failed to get fee rate', error);
      return null;
    }
  }

  async setFeeRate(scope: Caip2ChainId, value: Fees): Promise<void> {
    try {
      await this.update(async (state: SerializedCacheState) => {
        state.feeRate[scope] = new SerializableFees(value).serialize();
      });
    } catch (error) {
      throw compactError(error, Error);
    }
  }
}
