# Bitcoin Wallet Snap

This package contains the source code for the Bitcoin Wallet Snap - a MetaMask Snap that enables Bitcoin blockchain functionality directly within your MetaMask wallet. The Snap allows users to:

- Create and manage Bitcoin accounts
- View BTC balances
- Sign messages and transactions
- Send and receive transactions
- Connect to Bitcoin-enabled dApps

The Snap is built using the MetaMask Snaps SDK and integrates with Bitcoin libraries for blockchain interactions. It follows best practices for security and provides a seamless user experience within the familiar MetaMask interface.

![Snap UI](./docs/ui.png)

## Running the snap locally

```bash
yarn workspace @metamask/bitcoin-wallet-snap start
```

> [!WARNING]  
> When snap updates you will need to still reconnect from the dapp to see changes

> [!TIP]
> Alternatively you can build and serve the snap manually. This can sometimes be more stable than watch mode but requires a manual rebuild and serve anytime there is a change on the snap.

## Building and serving snap manually

```bash
yarn workspace @metamask/bitcoin-wallet-snap build
yarn workspace @metamask/bitcoin-wallet-snap serve
```

Further reading:

- [Development](../../docs/development.md)
- [Contributing](../../docs/contributing.md)
- [Releasing](../../docs/release.md)
