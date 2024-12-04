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
  serializedData: SerializeData;

  update(data: Data): void;
  serialize(): SerializeData;
  deserialize(serializeData: SerializeData): void;
};

export class SerializableFees
  implements ISerializable<WithExpiration<Fees>, SerializedFees>
{
  serializedData: SerializedFees = {
    fees: [],
    expiration: 0,
  };

  data: WithExpiration<Fees> = {
    fees: [],
    expiration: 0,
  };

  update(data: Fees) {
    this.data = {
      ...data,
      expiration: Date.now() + DefaultCacheTtl,
    };
  }

  valueOf() {
    return this.data;
  }

  serialize() {
    return this.serializedData;
  }

  deserialize(serializeData: SerializedFees): void {
    Object.entries(serializeData.fees).forEach(([key, value]) => {
      const fee = value as { type: string; rate: string };
      this.data.fees[key] = {
        type: fee.type,
        rate: BigInt(fee.rate),
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

  async getFeeRate(scope: Caip2ChainId): Promise<Fees | null> {
    try {
      const state = await this.get();
      const cachedValue = state.feeRate[scope];
      const fee = cachedValue.value.valueOf();

      return fee;
    } catch (error) {
      logger.warn('Failed to get fee rate', error);
      return null;
    }
  }

  async setFeeRate(scope: Caip2ChainId, value: Fees): Promise<void> {
    try {
      await this.update(async (state: CacheState) => {
        state.feeRate[scope].value.update(value);
      });
    } catch (error) {
      throw compactError(error, Error);
    }
  }
}
