# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.11.0]

### Uncategorized

- feat: align latest dependencies ([#443](https://github.com/MetaMask/snap-bitcoin-wallet/pull/443))

## [0.10.0]

### Changed

- Bump `@metamask/providers` to `^20.0.0` and `@metamask/keyring-api` to `^17.2.0` ([#388](https://github.com/MetaMask/snap-bitcoin-wallet/pull/388), [#405](https://github.com/MetaMask/snap-bitcoin-wallet/pull/405), [#416](https://github.com/MetaMask/snap-bitcoin-wallet/pull/416))

## [0.9.0]

### Changed

- Bump `@metamask/keyring-api` from `^9.0.0` to `^13.0.0` ([#364](https://github.com/MetaMask/snap-bitcoin-wallet/pull/364))
  - This version provides a new modules layout and adds support for the new mandatory `scopes` field for `KeyringAccount`.

## [0.8.2]

## [0.8.1]

## [0.8.0]

### Changed

- **BREAKING:** Rename `btc_sendmany` method to `sendBitcoin` ([#303](https://github.com/MetaMask/snap-bitcoin-wallet/pull/303))

## [0.7.0]

## [0.6.1]

### Changed

- Bump `@metamask/keyring-api` from `^8.0.2` to `^8.1.3` ([#253](https://github.com/MetaMask/snap-bitcoin-wallet/pull/253))
  - This version is now built slightly differently and is part of the [accounts monorepo](https://github.com/MetaMask/accounts).

## [0.6.0]

## [0.5.0]

### Added

- Add `getMaxSpendableBalance` RPC endpoint ([#188](https://github.com/MetaMask/snap-bitcoin-wallet/pull/188))

## [0.4.0]

## [0.3.0]

### Added

- Add `estimateFee` card ([#169](https://github.com/MetaMask/snap-bitcoin-wallet/pull/169))

## [0.2.5]

### Changed

- Remove unused code for example dapp ([#192](https://github.com/MetaMask/snap-bitcoin-wallet/pull/192))
  - It's no longer possible to create accounts from the example dapp, it must be done from the extension.

## [0.2.4]

## [0.2.3]

### Added

- Add network dropdown on example dapp ([#116](https://github.com/MetaMask/snap-bitcoin-wallet/pull/116))
- Update permission list for localhost ([#147](https://github.com/MetaMask/snap-bitcoin-wallet/pull/147))

### Fixed

- Audit 4.24: Remove temporary create account endpoint ([#115](https://github.com/MetaMask/snap-bitcoin-wallet/pull/115))

## [0.2.2]

## [0.2.1]

### Changed

- Fix linting errors ([#150](https://github.com/MetaMask/snap-bitcoin-wallet/pull/150))

## [0.2.0]

### Changed

- Rename `example` to `site` ([#145](https://github.com/MetaMask/snap-bitcoin-wallet/pull/145))

## [0.1.2]

### Changed

- fix: update change log format ([#76](https://github.com/MetaMask/bitcoin/pull/76))
- fix: update package.json ([#76](https://github.com/MetaMask/bitcoin/pull/74))

## [0.1.1]

### Added

- feat: implement keyring api handler btc_sendmany ([#65](https://github.com/MetaMask/bitcoin/pull/65))
- feat: implement broadcast txn api ([#57](https://github.com/MetaMask/bitcoin/pull/57))
- feat: add chain API - chain_getDataForTransaction ([#42](https://github.com/MetaMask/bitcoin/pull/42))
- feat: add chain API - chain_estimateFees ([#18](https://github.com/MetaMask/bitcoin/pull/18))
- feat: add ListAccountsButton card ([#43](https://github.com/MetaMask/bitcoin/pull/43))
- Update index.tsx ([#45](https://github.com/MetaMask/bitcoin/pull/45))
- fix: update btc asset ([#44](https://github.com/MetaMask/bitcoin/pull/44))
- feat: add method to convert sat to btc ([#34](https://github.com/MetaMask/bitcoin/pull/34))
- fix: refine coding structure ([#25](https://github.com/MetaMask/bitcoin/pull/25))
- feat: implement chain api - get balance ([#16](https://github.com/MetaMask/bitcoin/pull/16))
- feat: setup init cd to publish snap to npm public registry ([#15](https://github.com/MetaMask/bitcoin/pull/15))
- feat: add blockchair and update getBalances to accept multiple address ([#11](https://github.com/MetaMask/bitcoin/pull/11))
- build(deps): bump @metamask/keyring-api from 5.1.0 to 6.0.0 ([#6](https://github.com/MetaMask/bitcoin/pull/6))
- feat: init commit

[Unreleased]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.8.2...v0.9.0
[0.8.2]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.5...v0.3.0
[0.2.5]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MetaMask/snap-bitcoin-wallet/releases/tag/v0.1.1
