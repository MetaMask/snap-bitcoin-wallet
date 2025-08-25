# Bitcoin Wallet Snap Monorepo

![Hero Illustration](docs/hero.png)

Bringing official Bitcoin support to MetaMask. Create accounts, check balances, and perform Bitcoin transactions right from your MetaMask wallet. Simple, secure, and seamless.

## Installation

This repository contains the Bitcoin Wallet Snap, a MetaMask plugin for the browser extension and mobile app. To use it, you'll need to:

1. First, clone and set up the [MetaMask Extension repository](https://github.com/MetaMask/metamask-extension)
2. Then install this snap in your local MetaMask extension development environment:

```bash
# In your metamask-extension directory
npm i @metamask/bitcoin-wallet-snap
# or
yarn add @metamask/bitcoin-wallet-snap
```

This dual repository setup allows you to develop and test the Bitcoin Wallet Snap alongside the main MetaMask extension. The snap is installed as a dependency in the MetaMask extension repository, where it can be tested and integrated.

## API Documentation

### For MetaMask Developers (`onClientRequest`)

MetaMask interacts with the Bitcoin Wallet Snap via its [JSON-RPC API](packages/snap/openrpc.json) for client-only requests (as defined in [SIP-31](https://github.com/MetaMask/SIPs/blob/main/SIPS/sip-31.md)). The complete API specification is documented in the OpenRPC format.

### For dApp Developers (`submitRequest`)

dApp developers can interact with the wallet capabilities via the `submitRequest` endpoint. See the [keyring.openrpc.json](packages/snap/keyring.openrpc.json) for details.

### Viewing the API Documentation

To view either specification in a user-friendly format:

1. Go to the [OpenRPC Playground](https://playground.open-rpc.org/), or any other OpenRPC viewer of your liking
2. Copy the contents of the respective OpenRPC JSON file
3. Paste it into the playground's editor
4. Explore the interactive documentation with method details, parameters, examples, and error specifications

### Available Methods

The `onClientRequest` API includes methods for client-only operations like transaction flows without user confirmation.

The `submitRequest` API includes methods for:

- Wallet operations - Account management, transaction signing and broadcasting, PSBT/message signing, coin selection and more.

## Contributing

We welcome contributions to the Bitcoin Wallet Snap! Please read our [Contributing](docs/contributing.md) guidelines to get started.
