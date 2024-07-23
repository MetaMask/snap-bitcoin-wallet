# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.5]

### Uncategorized

- chore: update internal dependencies ([#197](https://github.com/MetaMask/snap-bitcoin-wallet/pull/197))
- chore: fix overrided message in MethodNotFoundError ([#189](https://github.com/MetaMask/snap-bitcoin-wallet/pull/189))
- chore: add reusable error ([#185](https://github.com/MetaMask/snap-bitcoin-wallet/pull/185))
- refactor: use custom superstruct validator for AmountStruct ([#184](https://github.com/MetaMask/snap-bitcoin-wallet/pull/184))
- chore: update '@metamask/\*' dependencies ([#183](https://github.com/MetaMask/snap-bitcoin-wallet/pull/183))
- chore: rename struct to pascal case ([#172](https://github.com/MetaMask/snap-bitcoin-wallet/pull/172))
- chore: fix typos ([#176](https://github.com/MetaMask/snap-bitcoin-wallet/pull/176))

## [0.2.4]

### Fixed

- Audit 4.5: Show origin on `btc_sendmany` confirmation dialog ([#152](https://github.com/MetaMask/snap-bitcoin-wallet/pull/152))
- Audit 4.7: Fix potential URL injections in Blockchair API calls ([#132](https://github.com/MetaMask/snap-bitcoin-wallet/pull/132))
- Audit 4.11: Remove code for creating unsupported P2SHP2WPKH account type ([#118](https://github.com/MetaMask/snap-bitcoin-wallet/pull/118))
- Audit 4.12: Derive accounts with different HD path by network ([#118](https://github.com/MetaMask/snap-bitcoin-wallet/pull/118))
- Audit 4.19: Implement keyring method `filterAccountChains` ([#122](https://github.com/MetaMask/snap-bitcoin-wallet/pull/122))

## [0.2.3]

### Changed

- Change Snap name to "Bitcoin Manager" ([#158](https://github.com/MetaMask/snap-bitcoin-wallet/pull/158))
- Change local dapp port ([#147](https://github.com/MetaMask/snap-bitcoin-wallet/pull/147))

### Fixed

- Audit 4.2: Remove update account method ([#130](https://github.com/MetaMask/snap-bitcoin-wallet/pull/130))
- Audit 4.3: Restrict permissions for Portfolio origin ([#131](https://github.com/MetaMask/snap-bitcoin-wallet/pull/131))
- Audit 4.4: Restrict permissions for MetaMask origin ([#141](https://github.com/MetaMask/snap-bitcoin-wallet/pull/141))
- Audit 4.8: Ensure that `request.method` in submit request is part of `account.methods` ([#133](https://github.com/MetaMask/snap-bitcoin-wallet/pull/133))
- Audit 4.9: Validate non-hex string in `hexToBuffer` ([#134](https://github.com/MetaMask/snap-bitcoin-wallet/pull/134))
- Audit 4.13: Add a safeguard for change output ([#135](https://github.com/MetaMask/snap-bitcoin-wallet/pull/135))
- Audit 4.14: Rename `txHash` to `signedTransaction` ([#120](https://github.com/MetaMask/snap-bitcoin-wallet/pull/120))
- Audit 4.20: Validate `headLength` and `tailLength` in `replaceMiddleChar` ([#138](https://github.com/MetaMask/snap-bitcoin-wallet/pull/138))
- Audit 4.23: Disable logging for production builds ([#124](https://github.com/MetaMask/snap-bitcoin-wallet/pull/124))
- Audit 4.24: Remove temporary create account endpoint ([#115](https://github.com/MetaMask/snap-bitcoin-wallet/pull/115))

## [0.2.2]

### Changed

- Remove unused env var ([#148](https://github.com/MetaMask/snap-bitcoin-wallet/pull/148))

### Fixed

- Emit event on account creation ([#153](https://github.com/MetaMask/snap-bitcoin-wallet/pull/153))

## [0.2.1]

### Fixed

- Remove duplicate validation when getting balances ([#137](https://github.com/MetaMask/snap-bitcoin-wallet/pull/137))

## [0.2.0]

### Added

- Add 'ramps-dev.portfolio.metamask.io' origin ([#144](https://github.com/MetaMask/snap-bitcoin-wallet/pull/144))
- Enable `getAccountBalances` method for Portfolio origins ([#126](https://github.com/MetaMask/snap-bitcoin-wallet/pull/126))
- Implement Keyring API `getAccountBalances` method ([#84](https://github.com/MetaMask/snap-bitcoin-wallet/pull/84))
- Implement Chain API `getTransactionStatus` method ([#85](https://github.com/MetaMask/snap-bitcoin-wallet/pull/85))

### Changed

- Rename "Bitcoin Manager" to "Bitcoin Wallet" ([#142](https://github.com/MetaMask/snap-bitcoin-wallet/pull/142))
- Improve `btc_sendMany` implementation ([#97](https://github.com/MetaMask/snap-bitcoin-wallet/pull/97))
- Update `btc_sendMany` dialogs ([#83](https://github.com/MetaMask/snap-bitcoin-wallet/pull/83))

## [0.1.2]

### Changed

- fix: update change log format ([#76](https://github.com/MetaMask/bitcoin/pull/76))
- fix: update package.json ([#76](https://github.com/MetaMask/bitcoin/pull/74))

## [0.1.1]

### Added

- fix: update resp of chainService - boardcastTransaction ([#68](https://github.com/MetaMask/bitcoin/pull/68))
- feat: add auto install script ([#67](https://github.com/MetaMask/bitcoin/pull/67))
- feat: add while list domain ([#71](https://github.com/MetaMask/bitcoin/pull/71))
- chore: re structure ([#66](https://github.com/MetaMask/bitcoin/pull/66))
- fix: change to keyring state method get wallet ([#62](https://github.com/MetaMask/bitcoin/pull/62))
- feat: implement keyring api - btc_sendmany ([#65](https://github.com/MetaMask/bitcoin/pull/65))
- chore: update snap provider instance name ([#69](https://github.com/MetaMask/bitcoin/pull/69))
- build(deps-dev): bump @metamask/snaps-jest from 7.0.2 to 8.0.0 ([#50](https://github.com/MetaMask/bitcoin/pull/50))
- feat: add bufferToString method ([#61](https://github.com/MetaMask/bitcoin/pull/61))
- feat: add chain API - chain_broadcastTransaction ([#57](https://github.com/MetaMask/bitcoin/pull/57))
- chore: add unit test for get balances ([#58](https://github.com/MetaMask/bitcoin/pull/58))
- feat: add chain API - chain_getDataForTransaction ([#42](https://github.com/MetaMask/bitcoin/pull/42))
- feat: add chain API - chain_estimateFees ([#18](https://github.com/MetaMask/bitcoin/pull/18))
- feat: add keyring API - btc_sendmany skeleton ([#41](https://github.com/MetaMask/bitcoin/pull/41))
- fix: update btc asset ([#44](https://github.com/MetaMask/bitcoin/pull/44))
- feat: add ListAccountsButton card ([#43](https://github.com/MetaMask/bitcoin/pull/43))
- chore: move config to factory ([#35](https://github.com/MetaMask/bitcoin/pull/35))
- feat: add methods to support satoshi to btc, and btc to satoshi ([#34](https://github.com/MetaMask/bitcoin/pull/34))
- chore: add commit method in state management ([#32](https://github.com/MetaMask/bitcoin/pull/32))
- fix: restructure code ([#31](https://github.com/MetaMask/bitcoin/pull/31))
- fix: remove non ready code ([#30](https://github.com/MetaMask/bitcoin/pull/30))
- fix: fix snap publish package is not using builded snap config ([#29](https://github.com/MetaMask/bitcoin/pull/29))
- feat: add api key for blockchair ([#27](https://github.com/MetaMask/bitcoin/pull/27))
- chore: restructure the code repo to fit to chain api and keyring api structure ([#26](https://github.com/MetaMask/bitcoin/pull/26))
- fix: refine coding structure ([#25](https://github.com/MetaMask/bitcoin/pull/25))
- feat: support transactional state management ([#20](https://github.com/MetaMask/bitcoin/pull/20))
- feat: add permission validation ([#24](https://github.com/MetaMask/bitcoin/pull/24))
- fix: remove un use code in BaseSnapRpcHandler ([#19](https://github.com/MetaMask/bitcoin/pull/19))
- feat: add validation on api response ([#17](https://github.com/MetaMask/bitcoin/pull/17))
- feat: implement chain api - get balances ([#16](https://github.com/MetaMask/bitcoin/pull/16))
- feat: setup init cd to publish snap to npm public registry ([#15](https://github.com/MetaMask/bitcoin/pull/15))
- feat: implement chain api skeleton ([#14](https://github.com/MetaMask/bitcoin/pull/14))
- feat: emit keyring event before state store ([#13](https://github.com/MetaMask/bitcoin/pull/13))
- feat: implement keyring api ([#12](https://github.com/MetaMask/bitcoin/pull/12))
- feat: add blockchair ([#11](https://github.com/MetaMask/bitcoin/pull/11))
- chore: update keyring type and methods permission ([#10](https://github.com/MetaMask/bitcoin/pull/10))
- chore: update snap icon ([#9](https://github.com/MetaMask/bitcoin/pull/9))
- fix: the ci pipeline for metamask task issue ([#8](https://github.com/MetaMask/bitcoin/pull/8))
- build(deps): bump @metamask/keyring-api from 5.1.0 to 6.0.0 ([#6](https://github.com/MetaMask/bitcoin/pull/6))
- build(deps-dev): bump @metamask/snaps-jest from 6.0.2 to 7.0.2 ([#7](https://github.com/MetaMask/bitcoin/pull/7))
- feat: add snap unit test ([#1](https://github.com/MetaMask/bitcoin/pull/1))
- feat: add CI for lint and test ([#2](https://github.com/MetaMask/bitcoin/pull/2))
- feat: init commit

[Unreleased]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.5...HEAD
[0.2.5]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MetaMask/snap-bitcoin-wallet/releases/tag/v0.1.1
