# Bitcoin Snap Architecture Overview

This document provides an overview of the architecture of the Bitcoin Snap, a MetaMask Snap that enables Bitcoin wallet functionality within the MetaMask ecosystem. It is targeted at new developers who want to understand the codebase structure, key concepts, and how components interact. The architecture follows the principles of **Clean Architecture**, which emphasizes separation of concerns, independence from external frameworks, and testability. This allows the core business logic to remain agnostic to external dependencies like blockchain APIs or UI frameworks.

We'll break down the architecture into its main layers, explain the role of the infrastructure layer (which wraps external dependencies), and highlight key dependencies such as the Bitcoin Dev Kit (BDK) and Esplora.

## What is Clean Architecture?

Clean Architecture, popularized by Robert C. Martin (Uncle Bob), organizes code into concentric layers where inner layers are independent of outer ones. The goal is to keep the core domain logic (entities and use cases) pure and decoupled from external concerns like databases, APIs, or UI.

In this Snap:

- **Entities** (innermost layer): Define the core domain models (e.g., BitcoinAccount, Transaction).
- **Use Cases** (business logic): Orchestrate operations using entities, without knowing about external systems.
- **Adapters/Infra** (outer layer): Wrap external dependencies to make them usable by use cases.
- **Repositories/Store**: Handle data persistence (e.g., in Snap state).
- **Handlers** (entry points): Interface with the MetaMask Snap SDK, routing requests to use cases.

This structure ensures that changes to external dependencies (e.g., a new blockchain API) don't affect the core logic. The flow is typically: Handler → Use Case → Repository/Infra → External Dependency.

The main entry point is `packages/snap/src/index.ts`, which initializes all layers and exports handlers for Snap lifecycle events (e.g., `onRpcRequest`, `onKeyringRequest`).

## Code Structure and Layers

The codebase is organized under `packages/snap/src/` with directories mirroring the architectural layers:

### 1. Entities (`src/entities/`)

- **Purpose**: Defines the core domain models and types that represent Bitcoin concepts, independent of any external implementation.
- **Key Files**:
  - `account.ts`: Defines `BitcoinAccount` interface (e.g., methods like `peekAddress()`, `startSync()`, balance handling).
  - `transaction.ts`: Defines `TransactionBuilder` for building PSBTs (Partially Signed Bitcoin Transactions).
  - `chain.ts`: Interfaces for blockchain interactions (e.g., `BlockchainClient` for syncing and broadcasting).
  - `snap.ts`: Snap-specific types like `SnapClient` for interacting with MetaMask Snap APIs.
  - Other: Error types, configs, rates, etc.
- **Why Clean?**: Entities are pure TypeScript interfaces/types. They don't import external libraries, making them portable and testable.

### 2. Use Cases (`src/use-cases/`)

- **Purpose**: Contains business logic that operates on entities. These classes coordinate actions like creating accounts, syncing balances, or building transactions.
- **Key Classes**:
  - `AccountUseCases.ts`: Handles account creation, discovery, synchronization, transaction signing, and broadcasting (e.g., `create()`, `synchronize()`, `sendPsbt()`).
  - `SendFlowUseCases.ts`: Manages the transaction sending flow, including UI interactions for form filling and review (e.g., `display()`, `onChangeForm()`).
  - `AssetsUseCases.ts`: Handles asset-related operations like market data and conversions.
- **Dependencies**: Inject repositories and infra adapters (e.g., `BitcoinAccountRepository`, `BlockchainClient`). No direct external calls—everything is abstracted.
- **Example Flow**: To create an account, `AccountUseCases` derives paths, checks for existence via repository, and syncs with the chain via an injected `BlockchainClient`.
- **Why Clean?**: Use cases focus on "what" needs to happen (business rules) without "how" (e.g., no direct API calls to Esplora).

### 3. Infra (`src/infra/`)

- **Purpose**: Adapters that wrap external dependencies, implementing entity interfaces. This layer bridges the gap between clean domain logic and real-world tools/APIs, ensuring the core remains independent.
- **Key Adapters**:
  - **BDK (Bitcoin Dev Kit)**: A Rust-based library for Bitcoin wallet operations, compiled to Wasm for Snap compatibility.
    - `BdkAccountAdapter.ts`: Implements `BitcoinAccount` using BDK's `Wallet` class. Handles address generation, syncing, PSBT signing, and balance queries.
    - `BdkTxBuilderAdapter.ts`: Implements `TransactionBuilder` for creating and modifying PSBTs (e.g., adding recipients, setting fees).
    - Role: BDK is the core engine for cryptographic operations, descriptor management, and transaction building. It's wrapped to match the Snap's entity interfaces, isolating BDK specifics.
  - **Esplora**: A lightweight Bitcoin blockchain explorer API (e.g., from Blockstream or Mempool.space).
    - `EsploraClientAdapter.ts`: Implements `BlockchainClient` for full scans, syncing, fee estimation, and transaction broadcasting.
    - Role: Esplora provides blockchain data without running a full node. It's configured per network (bitcoin, testnet, etc.) and handles retries/errors.
  - Other Adapters:
    - `PriceApiClientAdapter.ts`: Wraps an external price API for fiat conversions and market data.
    - `SnapClientAdapter.ts`: Wraps MetaMask Snap SDK functions (e.g., `snap_manageState`, `snap_dialog`) for state management and UI prompts.
    - `ConsoleLoggerAdapter.ts`: Simple logging wrapper.
    - `LocalTranslatorAdapter.ts`: Handles internationalization using locale files.
    - `jsx/`: JSX components for Snap UI (e.g., `SendFormView.tsx`, `ReviewTransactionView.tsx`).
- **Why Clean?**: Infra isolates externalities. If we switch from Esplora to another explorer, only this adapter changes—use cases remain untouched.

### 4. Store/Repositories (`src/store/`)

- **Purpose**: Data access layer for persistence, implementing repository patterns. In Snaps, data is stored in encrypted Snap state via `snap_manageState`.
- **Key Classes**:
  - `BdkAccountRepository.ts`: Manages Bitcoin accounts (create, read, update, delete) in Snap state. Uses BDK for wallet data serialization.
  - `JSXSendFlowRepository.tsx`: Handles UI state for transaction flows (e.g., form contexts) using Snap's interface APIs.
- **Why Clean?**: Repositories abstract storage, so use cases don't know about Snap state mechanics.

### 5. Handlers (`src/handlers/`)

- **Purpose**: Entry points for MetaMask Snap APIs. These route incoming requests (e.g., RPC, keyring, cron) to use cases.
- **Key Classes**:
  - `KeyringHandler.ts`: Implements MetaMask's Keyring API for account management (e.g., `listAccounts()`, `signPsbt()`).
  - `RpcHandler.ts`: Handles custom RPC methods like starting a send flow or filling PSBTs.
  - `UserInputHandler.ts`: Processes UI events (e.g., form changes in transaction flows).
  - `CronHandler.ts`: Scheduled tasks like account syncing or rate refreshing.
  - `AssetsHandler.ts`: Asset queries (e.g., historical prices, conversions).
  - `HandlerMiddleware.ts`: Wraps handlers with error handling and logging.
- **Why Clean?**: Handlers are the outermost layer, depending on use cases but not vice versa.

## How It All Fits Together

- **Initialization** (`index.ts`): Creates instances of infra adapters, repositories, use cases, and handlers. Dependencies are injected (e.g., `AccountUseCases` gets a logger, repository, and chain client).
- **Example Flow: Sending a Transaction**
  1. RPC request hits `RpcHandler` (e.g., `startSendTransactionFlow`).
  2. Routes to `SendFlowUseCases.display()`, which uses repositories for state and infra for UI rendering.
  3. User interacts via `UserInputHandler`, updating the flow.
  4. Final PSBT is built/signed via `AccountUseCases` (using BDK adapter) and broadcast via Esplora adapter.
- **Cron Jobs**: `CronHandler` periodically syncs accounts using `AccountUseCases`.
- **Error Handling**: Custom errors (e.g., `ValidationError`, `ExternalServiceError`) are thrown and handled in middleware.

## Key External Dependencies

- **BDK (Bitcoin Dev Kit)**: Core for wallet crypto (addresses, signing, balances). Wrapped in infra to abstract its Rust/Wasm API.
- **Esplora**: Blockchain backend for queries and broadcasts. Configurable per network, with fallbacks.
- **MetaMask Snap SDK**: For state, dialogs, and events. Wrapped in `SnapClientAdapter`.
  BUIL- Others: Price API for rates, i18n for locales.

## Getting Started for New Devs

- Start in `index.ts` to see wiring.
- Explore entities for domain understanding.
- Check use cases for business flows.
- Use tests (e.g., `AccountUseCases.test.ts`) to see examples.
- For changes: Modify infra for new deps, keep use cases pure.

This architecture promotes maintainability and scalability. If you have questions or need to extend it, refer to the code or contributing guidelines.
