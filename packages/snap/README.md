# Bitcoin Wallet Snap

This package contains the source code for the Bitcoin Wallet Snap - a MetaMask Snap that enables Bitcoin blockchain functionality directly within your MetaMask wallet. The Snap allows users to:

- Create and manage Bitcoin accounts accross all address types (p2pkh, p2sh, p2wpkh, p2tr)
- View BTC balances and history
- Sign transactions (PSBTs)
- Send and receive transactions
- Connect to Bitcoin dApps
- Support all networks (Bitcoin, Testnet3, Testnet4, Signet via Mutinynet and Regtest)

The Snap is built using the MetaMask Snaps SDK and integrates with [Bitcoindevkit](https://bitcoindevkit.org/). It follows best practices for security and provides a seamless user experience within the familiar MetaMask interface.

![Snap UI](./docs/ui.png)

## Running the snap locally

```bash
yarn start
```

> [!WARNING]  
> When snap updates you will need to still reconnect from the dapp to see changes

## Building

```bash
yarn build:snap
```

Further reading:

- [Development](../../docs/development.md)
- [Contributing](../../docs/contributing.md)
- [Releasing](../../docs/release.md)
