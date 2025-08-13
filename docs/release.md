# Releasing @metamask/bitcoin-wallet-snap

When the time comes to release, follow these steps:

1. Trigger "Create release PR" workflow manually.
2. Check that everything that's to be released is included in the [CHANGELOG](../packages/snap/CHANGELOG.md) changes.
3. Chase approval and merge.
4. Wait for the action in `main` to finish and publish the package.
5. Update the version on [the extension](https://github.com/MetaMask/metamask-extension) and [mobile app](https://github.com/MetaMask/metamask-mobile) `package.json`.
