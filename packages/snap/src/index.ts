import type {
  OnAssetsConversionHandler,
  OnAssetsLookupHandler,
  OnCronjobHandler,
  OnKeyringRequestHandler,
  OnUserInputHandler,
  OnAssetHistoricalPriceHandler,
  OnAssetsMarketDataHandler,
  OnClientRequestHandler,
  OnActiveHandler,
} from '@metamask/snaps-sdk';

import { Config } from './config';
import {
  KeyringHandler,
  CronHandler,
  UserInputHandler,
  RpcHandler,
  AssetsHandler,
} from './handlers';
import { HandlerMiddleware } from './handlers/HandlerMiddleware';
import { KeyringRequestHandler } from './handlers/KeyringRequestHandler';
import {
  SnapClientAdapter,
  EsploraClientAdapter,
  PriceApiClientAdapter,
  ConsoleLoggerAdapter,
  LocalTranslatorAdapter,
} from './infra';
import { BdkAccountRepository, JSXSendFlowRepository } from './store';
import { InMemoryCache } from './store/InMemoryCache';
import { JSXConfirmationRepository } from './store/JSXConfirmationRepository';
import {
  AccountUseCases,
  AssetsUseCases,
  ConfirmationUseCases,
  SendFlowUseCases,
} from './use-cases';

// Infra layer
const logger = new ConsoleLoggerAdapter(Config.logLevel);
const snapClient = new SnapClientAdapter(Config.encrypt);
const chainClient = new EsploraClientAdapter(Config.chain);
const assetRatesClient = new PriceApiClientAdapter(Config.priceApi);
const translator = new LocalTranslatorAdapter();
const middleware = new HandlerMiddleware(logger, snapClient, translator);

// Data layer
const accountRepository = new BdkAccountRepository(snapClient);
const sendFlowRepository = new JSXSendFlowRepository(snapClient, translator);
const confirmationRepository = new JSXConfirmationRepository(
  snapClient,
  translator,
  chainClient,
);

// Business layer
const accountsUseCases = new AccountUseCases(
  logger,
  snapClient,
  accountRepository,
  confirmationRepository,
  chainClient,
  Config.fallbackFeeRate,
  Config.targetBlocksConfirmation,
);
const sendFlowUseCases = new SendFlowUseCases(
  logger,
  snapClient,
  accountRepository,
  accountsUseCases,
  sendFlowRepository,
  chainClient,
  assetRatesClient,
  Config.targetBlocksConfirmation,
  Config.fallbackFeeRate,
  Config.ratesRefreshInterval,
);
const assetsUseCases = new AssetsUseCases(
  logger,
  assetRatesClient,
  new InMemoryCache(),
);
const confirmationUseCases = new ConfirmationUseCases(logger, snapClient);

// Application layer
const keyringRequestHandler = new KeyringRequestHandler(
  accountsUseCases,
  confirmationRepository,
);
const keyringHandler = new KeyringHandler(
  keyringRequestHandler,
  accountsUseCases,
  Config.defaultAddressType,
  snapClient,
  logger,
);
const cronHandler = new CronHandler(
  accountsUseCases,
  sendFlowUseCases,
  snapClient,
  snap,
);
const rpcHandler = new RpcHandler(sendFlowUseCases, accountsUseCases, logger);
const userInputHandler = new UserInputHandler(
  sendFlowUseCases,
  confirmationUseCases,
);
const assetsHandler = new AssetsHandler(
  assetsUseCases,
  Config.conversionsExpirationInterval,
  logger,
);

export const onCronjob: OnCronjobHandler = async ({ request }) =>
  middleware.handle(async () => cronHandler.route(request));

export const onClientRequest: OnClientRequestHandler = async ({ request }) =>
  middleware.handle(async () => rpcHandler.route('metamask', request));

export const onKeyringRequest: OnKeyringRequestHandler = async ({ request }) =>
  middleware.handle(async () => keyringHandler.route(request));

export const onUserInput: OnUserInputHandler = async ({ id, event, context }) =>
  middleware.handle(async () => userInputHandler.route(id, event, context));

export const onAssetsLookup: OnAssetsLookupHandler = async () =>
  middleware.handle(async () => assetsHandler.lookup());

export const onAssetsConversion: OnAssetsConversionHandler = async ({
  conversions,
}) => middleware.handle(async () => assetsHandler.conversion(conversions));

export const onAssetHistoricalPrice: OnAssetHistoricalPriceHandler = async ({
  from,
  to,
}) => middleware.handle(async () => assetsHandler.historicalPrice(from, to));

export const onAssetsMarketData: OnAssetsMarketDataHandler = async ({
  assets,
}) => middleware.handle(async () => assetsHandler.marketData(assets));

export const onActive: OnActiveHandler = async () =>
  middleware.handle(async () => cronHandler.synchronizeAccounts());
