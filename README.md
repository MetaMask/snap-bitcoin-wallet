# Bitcoin Snap Monorepo

<img src="./packages/snap/images/icon.svg" width="200" style="display: block; margin: 0 auto;" alt="Bitcoin Logo" />

## Getting Started

The Solana Wallet Snap allows MetaMask and dapps to support all Bitcoin-related networks and address types.

- [@metamask/bitcoin-wallet-snap](packages/snap/README.md)
- [@metamask/bitcoin-wallet-test-dapp](packages/site/README.md)

### Prerequisites

- [MetaMask Flask](https://metamask.io/flask/)
- Nodejs `20`. We **strongly** recommend you install via [NVM](https://github.com/creationix/nvm) to avoid incompatibility issues between different node projects.
  - Once installed, you should also install [Yarn](http://yarnpkg.com/) with `npm i -g yarn` to make working with this repository easiest.

## Installing

```bash
nvm use 20
yarn install
```

## Configuration

please see `./src/packages/.env.example` for reference

## Running

### Quick Start

```bash
yarn start
```

- Snap server and debug page: http://localhost:8080/
- Example UI dapp: http://localhost:3000/

### Snap

⚠️ When snap updates you will need to still reconnect from the dapp to see changes

```bash
# Running Snap via watch mode
yarn workspace @metamask/bitcoin-wallet-snap start
```

Alternatively you can build and serve the snap manually. This can sometimes be more stable than watch mode but requires
a manual rebuild and serve anytime there is a change on the snap.

```bash
# Building and serving snap manually
yarn workspace @metamask/bitcoin-wallet-snap build
yarn workspace @metamask/bitcoin-wallet-snap serve
```

### Example UI

```bash
# Running example UI
yarn workspace example start
```
