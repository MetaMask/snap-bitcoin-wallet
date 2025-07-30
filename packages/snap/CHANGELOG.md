# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.18.0]

### Added

- Fine-grained error handling with tracking and translations ([#496](https://github.com/MetaMask/snap-bitcoin-wallet/pull/496), [#498](https://github.com/MetaMask/snap-bitcoin-wallet/pull/498))
- Track transaction events ([#495](https://github.com/MetaMask/snap-bitcoin-wallet/pull/495))
- Add account options in `KeyringAccount` ([#499](https://github.com/MetaMask/snap-bitcoin-wallet/pull/499))

### Fixed

- Retry mechanism for Esplora indexer ([#500](https://github.com/MetaMask/snap-bitcoin-wallet/pull/500))

## [0.17.0]

### Changed

- Synchronize by default ([#492](https://github.com/MetaMask/snap-bitcoin-wallet/pull/492))

### Fixed

- Synchronize accounts with no history ([#491](https://github.com/MetaMask/snap-bitcoin-wallet/pull/491))

## [0.16.1]

### Fixed

- Typo `onAssetsMarketData` ([#489](https://github.com/MetaMask/snap-bitcoin-wallet/pull/489))

## [0.16.0]

### Added

- Asset market data on new handler ([#486](https://github.com/MetaMask/snap-bitcoin-wallet/pull/486))
- Send flow error handling ([#482](https://github.com/MetaMask/snap-bitcoin-wallet/pull/482))
- Translations ([#483](https://github.com/MetaMask/snap-bitcoin-wallet/pull/483))

### Changed

- Use event value on user input instead of fetching the form state ([#485](https://github.com/MetaMask/snap-bitcoin-wallet/pull/485))

## [0.15.0]

### Added

- Account index auto increment on creation ([#471](https://github.com/MetaMask/snap-bitcoin-wallet/pull/471))
- Account selector in send flow ([#479](https://github.com/MetaMask/snap-bitcoin-wallet/pull/479))
- Market data ([#478](https://github.com/MetaMask/snap-bitcoin-wallet/pull/478))
- Switch currencies in send flow ([#477](https://github.com/MetaMask/snap-bitcoin-wallet/pull/477))

### Changed

- Align Send flow ([#472](https://github.com/MetaMask/snap-bitcoin-wallet/pull/472))

### Fixed

- Entropy source as part of the `KeyringAccount` options ([#473](https://github.com/MetaMask/snap-bitcoin-wallet/pull/473))
- Delete account keeping residue in state ([#469](https://github.com/MetaMask/snap-bitcoin-wallet/pull/469))

## [0.14.1]

### Fixed

- Account name passthrough ([#466](https://github.com/MetaMask/snap-bitcoin-wallet/pull/466))
- Prevent account deletion key residues ([#466](https://github.com/MetaMask/snap-bitcoin-wallet/pull/466))

## [0.14.0]

### Added

- Discover accounts ([#464](https://github.com/MetaMask/snap-bitcoin-wallet/pull/464), [#460](https://github.com/MetaMask/snap-bitcoin-wallet/pull/460))
- Use address types from `keyring-api` ([#461](https://github.com/MetaMask/snap-bitcoin-wallet/pull/461))

### Changed

- Development environment cleanup ([#459](https://github.com/MetaMask/snap-bitcoin-wallet/pull/459))
- Use `setState` and `getState` instead of `manageState` ([#463](https://github.com/MetaMask/snap-bitcoin-wallet/pull/463))

## [0.13.0]

### Added

- Multi account ([#457](https://github.com/MetaMask/snap-bitcoin-wallet/pull/457))
- Historical prices ([#456](https://github.com/MetaMask/snap-bitcoin-wallet/pull/456))

## [0.12.1]

### Added

- Add unconfirmed transactions to wallet history ([#453](https://github.com/MetaMask/snap-bitcoin-wallet/pull/453))

### Changed

- Reduce bundle size ([#454](https://github.com/MetaMask/snap-bitcoin-wallet/pull/454))

## [0.12.0]

### Added

- Compress preinstalled Snap during build ([#451](https://github.com/MetaMask/snap-bitcoin-wallet/pull/451))

### Changed

- Disable UTXO protection ([#445](https://github.com/MetaMask/snap-bitcoin-wallet/pull/445))
- Generate PSBT in send flow ([#448](https://github.com/MetaMask/snap-bitcoin-wallet/pull/448))

### Removed

- Remove SimpleHash ([#447](https://github.com/MetaMask/snap-bitcoin-wallet/pull/447))

## [0.11.0]

### Added

- Support for `correlationId` and `entropySource` ([#443](https://github.com/MetaMask/snap-bitcoin-wallet/pull/443))

### Changed

- Refactor error handling ([#442](https://github.com/MetaMask/snap-bitcoin-wallet/pull/442))
- Refactor locale ([#433](https://github.com/MetaMask/snap-bitcoin-wallet/pull/433))
- Refactor logger ([#437](https://github.com/MetaMask/snap-bitcoin-wallet/pull/437))
- Reduce bundle size ([#439](https://github.com/MetaMask/snap-bitcoin-wallet/pull/439))

### Fixed

- Discard own outputs from send transactions ([#441](https://github.com/MetaMask/snap-bitcoin-wallet/pull/441))

## [0.10.0]

### Added

- List account transactions and assets ([#405](https://github.com/MetaMask/snap-bitcoin-wallet/pull/405), [#420](https://github.com/MetaMask/snap-bitcoin-wallet/pull/420), [#408](https://github.com/MetaMask/snap-bitcoin-wallet/pull/408), [#427](https://github.com/MetaMask/snap-bitcoin-wallet/pull/427))
- Refresh rates and fees in a background loop inside the Send Flow ([#419](https://github.com/MetaMask/snap-bitcoin-wallet/pull/419))
- On asset conversion handler ([#418](https://github.com/MetaMask/snap-bitcoin-wallet/pull/418))
- On asset lookup handler + emission of events on balance updates ([#416](https://github.com/MetaMask/snap-bitcoin-wallet/pull/416))
- Icons as base64 ([#422](https://github.com/MetaMask/snap-bitcoin-wallet/pull/422))
- Synchronize Bitcoin accounts in a cron job ([#407](https://github.com/MetaMask/snap-bitcoin-wallet/pull/407))
- Integration tests ([#382](https://github.com/MetaMask/snap-bitcoin-wallet/pull/382))
- Translations ([#403]https://github.com/MetaMask/snap-bitcoin-wallet/pull/403)

### Changed

- Refactor core Bitcoin library to use the [`bitcoindevkit`](https://www.npmjs.com/package/bitcoindevkit), allowing synchronization of multiple addresses, support of multiple networks (`bitcoin`, `testnet`, `signet`, `regtest`) and address types (`p2pkh`, `p2sh`, `p2wsh`, `p2wpkh`, `p2tr`) ([#361](https://github.com/MetaMask/snap-bitcoin-wallet/pull/361), [#393](https://github.com/MetaMask/snap-bitcoin-wallet/pull/393), [#394](https://github.com/MetaMask/snap-bitcoin-wallet/pull/394), [#378](https://github.com/MetaMask/snap-bitcoin-wallet/pull/378), [#411](https://github.com/MetaMask/snap-bitcoin-wallet/pull/411), [#413](https://github.com/MetaMask/snap-bitcoin-wallet/pull/413), [#414](https://github.com/MetaMask/snap-bitcoin-wallet/pull/414))
- Upgrade yarn to v4 ([#389](https://github.com/MetaMask/snap-bitcoin-wallet/pull/389))

### Removed

- Remove unused dependencies and codebase ([#417](https://github.com/MetaMask/snap-bitcoin-wallet/pull/417))

### Fixed

- Typo in word "Ordinals" ([#402](https://github.com/MetaMask/snap-bitcoin-wallet/pull/402))

## [0.9.0]

### Added

- Add localized messages ([#348](https://github.com/MetaMask/snap-bitcoin-wallet/pull/348))
- Add basic Sats protection support ([#337](https://github.com/MetaMask/snap-bitcoin-wallet/pull/337)), ([#284](https://github.com/MetaMask/snap-bitcoin-wallet/pull/284)), ([#349](https://github.com/MetaMask/snap-bitcoin-wallet/pull/349))
  - Using SimpleHash service.

### Changed

- **BREAKING:** Provide scopes field to `KeyringAccount` during account creation ([#364](https://github.com/MetaMask/snap-bitcoin-wallet/pull/364))
  - Bump `@metamask/keyring-api` from `^8.1.3` to `^13.0.0`.
  - Compatible with `@metamask/eth-snap-keyring@^7.1.0`.
- Support for fee rate caching ([#358](https://github.com/MetaMask/snap-bitcoin-wallet/pull/358))
- Use Snap UI update context instead of persisting request ([#345](https://github.com/MetaMask/snap-bitcoin-wallet/pull/345))
  - Making the Snap UI slighty more responsive and faster.
- Remove support of Blockchair service ([#298](https://github.com/MetaMask/snap-bitcoin-wallet/pull/298))

### Fixed

- Various UI fixes ([#356](https://github.com/MetaMask/snap-bitcoin-wallet/pull/356)), ([#357](https://github.com/MetaMask/snap-bitcoin-wallet/pull/357)), ([#346](https://github.com/MetaMask/snap-bitcoin-wallet/pull/346)), ([#344](https://github.com/MetaMask/snap-bitcoin-wallet/pull/344)), ([#343](https://github.com/MetaMask/snap-bitcoin-wallet/pull/343))
- Allow send to happen even when rates are not available ([#350](https://github.com/MetaMask/snap-bitcoin-wallet/pull/350))

## [0.8.2]

### Fixed

- Remove `localhost` from permissions ([#324](https://github.com/MetaMask/snap-bitcoin-wallet/pull/324)), ([#322](https://github.com/MetaMask/snap-bitcoin-wallet/pull/322))

## [0.8.1]

### Fixed

- Use `hideSnapBranding` flag when building ([#312](https://github.com/MetaMask/snap-bitcoin-wallet/pull/312))

## [0.8.0]

### Added

- Add send flow UI ([#281](https://github.com/MetaMask/snap-bitcoin-wallet/pull/281)), ([#309](https://github.com/MetaMask/snap-bitcoin-wallet/pull/309)), ([#308](https://github.com/MetaMask/snap-bitcoin-wallet/pull/308)), ([#305](https://github.com/MetaMask/snap-bitcoin-wallet/pull/305)), ([#304](https://github.com/MetaMask/snap-bitcoin-wallet/pull/304)), ([#289](https://github.com/MetaMask/snap-bitcoin-wallet/pull/289))
  - The send flow can be started using the `startSendTransactionFlow` internal method.
  - The UI allows to send an amount to one recipient (according to its balance).
  - There is a confirmation screen that summarize everything regarding the transaction (amount, recipient, fee estimation), once confirmed the transaction will be broadcasted to the blockchain.
  - Calling the `sendBitcoin` account's method will trigger the confirmation screen too.

### Changed

- **BREAKING:** Rename `btc_sendmany` method to `sendBitcoin` ([#303](https://github.com/MetaMask/snap-bitcoin-wallet/pull/303))
  - The `comment` and `subtractFeeFrom` options have been removed too.
- **BREAKING:** Make transactions replaceable by default ([#297](https://github.com/MetaMask/snap-bitcoin-wallet/pull/297))
- Rename proposed name to "Bitcoin" (was "Bitcoin Manager") ([#283](https://github.com/MetaMask/snap-bitcoin-wallet/pull/283))
- Adds fee estimation fallback for `QuickNode` ([#269](https://github.com/MetaMask/snap-bitcoin-wallet/pull/269))
  - In some cases, `QuickNode` may fail to process fee estimation. In such instances, we fall back on using fee information directly from the mempool.
  - We also added a default minimum fee as the last resort in case everything else failed.

## [0.7.0]

### Changed

- Use `QuickNode` as the main provider ([#250](https://github.com/MetaMask/snap-bitcoin-wallet/pull/250))
- Workaround `QuickNode` fee estimation for testnet ([#267](https://github.com/MetaMask/snap-bitcoin-wallet/pull/267))
  - We temporarily changed the confirmation target block to a higher block number to make sure the API is not failing with an error.

### Fixed

- Fix fee estimation with `QuickNode` ([#266](https://github.com/MetaMask/snap-bitcoin-wallet/pull/266)), ([#261](https://github.com/MetaMask/snap-bitcoin-wallet/pull/261))
  - Properly uses `kvB` instead of `vB`.
  - Will **NOT** throw an error if the account has not enough UTXOs when estimating the fees.

## [0.6.1]

### Added

- Add `QuickNode` API client ([#247](https://github.com/MetaMask/snap-bitcoin-wallet/pull/247))
  - This client is not yet used, we still use Blockchair provider for the moment.

### Changed

- Bump `@metamask/keyring-api` from `^8.0.2` to `^8.1.3` ([#253](https://github.com/MetaMask/snap-bitcoin-wallet/pull/253))
  - This version is now built slightly differently and is part of the [accounts monorepo](https://github.com/MetaMask/accounts).

## [0.6.0]

### Added

- Display an alert dialog when an error happens during `btc_sendmany` ([#236](https://github.com/MetaMask/snap-bitcoin-wallet/pull/236))

### Changed

- Use similar shorten-address format than the extension ([#238](https://github.com/MetaMask/snap-bitcoin-wallet/pull/238))

## [0.5.0]

### Added

- Add `getMaxSpendableBalance` RPC endpoint ([#188](https://github.com/MetaMask/snap-bitcoin-wallet/pull/188))

### Changed

- Improve keyring tests coverage ([#220](https://github.com/MetaMask/snap-bitcoin-wallet/pull/220))

## [0.4.0]

### Added

- Emit account suggested name when creating account ([#210](https://github.com/MetaMask/snap-bitcoin-wallet/pull/210))
  - This name suggestion can then be used by the client to name the account accordingly.

### Changed

- Audit 4.6: Pin Bitcoin and cryptographic dependencies ([#205](https://github.com/MetaMask/snap-bitcoin-wallet/pull/205))

## [0.3.0]

### Added

- Add `estimateFee` RPC endpoint ([#169](https://github.com/MetaMask/snap-bitcoin-wallet/pull/169))

## [0.2.5]

### Added

- Add reusable error types ([#185](https://github.com/MetaMask/snap-bitcoin-wallet/pull/185))

### Changed

- Use custom `superstruct` validator for `AmountStruct` ([#184](https://github.com/MetaMask/snap-bitcoin-wallet/pull/184))

### Fixed

- Fix overridden message in `MethodNotFoundError` ([#189](https://github.com/MetaMask/snap-bitcoin-wallet/pull/189))

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

[Unreleased]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.18.0...HEAD
[0.18.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.17.0...v0.18.0
[0.17.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.16.1...v0.17.0
[0.16.1]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.16.0...v0.16.1
[0.16.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.14.1...v0.15.0
[0.14.1]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.14.0...v0.14.1
[0.14.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/MetaMask/snap-bitcoin-wallet/compare/v0.11.0...v0.12.0
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
