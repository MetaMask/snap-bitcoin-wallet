# Bitcoin Snap

## Configuration

Rename `.env.example` to `.env`
Configurations are setup though `.env`,

## API:

### `keyring_createAccount`

example:

```typescript
provider.request({
  method: 'wallet_invokeKeyring',
  params: {
    snapId,
    request: {
      method: 'keyring_createAccount',
      params: {
        scope: 'bip122:000000000933ea01ad0ee984209779ba', // the CAIP-2 chain ID of the network
        addressType: 'bip122:p2wpkh', // the CAIP-2 address type
      },
    },
  },
});
```
