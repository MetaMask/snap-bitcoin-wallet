# Contributing to Snap Bitcoin Wallet

Thank you for your interest in contributing to the Snap Bitcoin Wallet project! This guide will help you get started with development and understand our contribution workflow.

## Prerequisites

- [MetaMask Flask](https://metamask.io/flask/) is required for testing the snap locally
- [NVM](https://github.com/creationix/nvm) to manage Node.js and avoid compatibility issues between different projects
- Node.js `v22.14` as specified in `.nvmrc`
- Yarn `4.9.1` is required due to MetaMask package compatibility

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/MetaMask/snap-bitcoin-wallet.git
cd snap-bitcoin-wallet
nvm use
yarn

# Configure environment
cp packages/snap/.env.example packages/snap/.env
cp packages/site/.env.example packages/site/.env

# Start development servers
yarn start # Runs snap server on local port `8080` and the test dapp at http://localhost:3000

# Lastly, install the snap in MetaMask Flask by following the steps below.
```

## 🧪 Testing Your Changes

### Manual Testing

#### Setting up MetaMask Flask

To test the snap manually, you will need to install it in MetaMask Flask. Follow these steps to set up MetaMask Flask:

1. Download and install MetaMask Flask from the official website or build it from source if needed.
2. Enable it in your browser.

#### Installing the snap in MetaMask Flask

1. Ensure your snap `.env` file is configured with appropriate values for local development.
2. Start the snap watcher and dapp with `yarn start`
3. Make your code changes
4. Wait for the snap to rebuild (you'll see a confirmation in the console)
5. Open the test dapp in your browser at http://localhost:3000/
6. Click the `Connect/Reconnect` button (or equivalent) to install the locally running snap into MetaMask Flask.

🎉 Congratulations, you're now ready to test your changes locally! You can interact with your snap through the test dapp and through the extension, and verify that everything works as expected.

### Unit Tests

1. Ensure the snap is running with `yarn start`
2. Run the test suite with `yarn test`

For specific tests, prefer running individual files, e.g., `yarn test MyTest`

### Integration Tests

Run integration tests with `yarn test:integration`. This will start a `docker-compose` with an Esplora test network (regression test, aka regtest)

## 🧑‍💻 Contribution Workflow

### Commit Guidelines

We use `commitlint` to enforce the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format. This helps maintain a clean changelog and consistent commit history. For a clean changelog, prefer using `feat` and `fix` commit types.

Git hooks are configured to automatically:

- Lint your commit messages
- Fix formatting and linting issues with `yarn lint:fix`

### Pull Requests

To create a successful PR:

1. Ensure all automated checks pass
2. Write a clear and detailed description
3. Include appropriate tests for your changes
