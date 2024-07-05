# Bitcoin Wallet Snap

## Manage Bitcoin using MetaMask

## Configuration

Rename `.env.example` to `.env`
Configurations are setup though `.env`,

```bash
LOG_LEVEL=6
# Description: Environment variables for API key of BlockChair
# Required: false
BLOCKCHAIR_API_KEY=
```

## Rpcs:

### API `keyring_createAccount`

example:

```typescript
provider.request({
  method: 'wallet_invokeKeyring',
  params: {
    snapId,
    request: {
      method: 'keyring_createAccount',
      params: {
        scope: 'bip122:000000000933ea01ad0ee984209779ba', // the CAIP-2 chain ID of bitcoin
      },
    },
  },
});
```

### API `keyring_getAccountBalances`

example:

```typescript
provider.request({
  method: 'wallet_invokeKeyring',
  params: {
    snapId,
    request: {
      method: 'keyring_getAccountBalances',
      params: {
        account: 'dc06350a-82db-434b-b113-066135804f63', // the uuid account id of the current account
        id: 'da40b782-e054-4260-9a6a-c8717a022f92', // an random uuid for this request
        assets: ['bip122:000000000019d6689c085ae165831e93/slip44:0'], // Caip-2 BTC Asset
      },
    },
  },
});
```

### API `chain_getTransactionStatus`

example:

```typescript
provider.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId,
    request: {
      method: 'chain_getTransactionStatus',
      params: {
        scope: 'bip122:000000000933ea01ad0ee984209779ba', // the CAIP-2 chain ID of bitcoin
        transactionId: '5639078d-742e-4901-8993-bc25a5ef6161', // the txn id of an bitcoin transaction
      },
    },
  },
});
```

### API `btc_sendmany`

example:

```typescript
provider.request({
  method: 'wallet_invokeKeyring',
  params: {
    snapId,
    request: {
      method: 'keyring_submitRequest',
      params: {
        account: 'dc06350a-82db-434b-b113-066135804f63', // the uuid account id of the current account
        id: 'da40b782-e054-4260-9a6a-c8717a022f92', // an random uuid for this request
        scope: 'bip122:000000000933ea01ad0ee984209779ba', // the CAIP-2 chain ID of bitcoin
        request: {
          method: 'btc_sendmany',
          params: {
            amounts: {
              ['tb1qlhkuysju47s642834n7f3tyk67mvnt2cfd9r7y']: '0.00000500',
            }, // the recipient struct to indicate how many BTC to be received for each recipient
            comment: 'some comment',
            subtractFeeFrom: [], // not support yet
            replaceable: false, // an flag to opt-in RBF
            dryrun: true, // an flag to enable similation of the transaction, without broadcast to network
          },
        },
      },
    },
  },
});
```
