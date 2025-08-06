import type {
  OnAssetsConversionHandler,
  OnAssetsLookupHandler,
  OnCronjobHandler,
  OnRpcRequestHandler,
  OnKeyringRequestHandler,
  OnUserInputHandler,
  OnAssetHistoricalPriceHandler,
  OnAssetsMarketDataHandler,
  OnClientRequestHandler,
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
import {
  SnapClientAdapter,
  EsploraClientAdapter,
  PriceApiClientAdapter,
  ConsoleLoggerAdapter,
  LocalTranslatorAdapter,
} from './infra';
import { BdkAccountRepository, JSXSendFlowRepository } from './store';
import { AccountUseCases, AssetsUseCases, SendFlowUseCases } from './use-cases';

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

// Business layer
const accountsUseCases = new AccountUseCases(
  logger,
  snapClient,
  accountRepository,
  chainClient,
  Config.fallbackFeeRate,
);
const sendFlowUseCases = new SendFlowUseCases(
  logger,
  snapClient,
  accountRepository,
  sendFlowRepository,
  chainClient,
  assetRatesClient,
  Config.targetBlocksConfirmation,
  Config.fallbackFeeRate,
  Config.ratesRefreshInterval,
);
const assetsUseCases = new AssetsUseCases(logger, assetRatesClient);

// Application layer
const keyringHandler = new KeyringHandler(
  accountsUseCases,
  Config.defaultAddressType,
);
const cronHandler = new CronHandler(logger, accountsUseCases, sendFlowUseCases);
const rpcHandler = new RpcHandler(sendFlowUseCases, accountsUseCases);
const userInputHandler = new UserInputHandler(sendFlowUseCases);
const assetsHandler = new AssetsHandler(
  assetsUseCases,
  Config.conversionsExpirationInterval,
);

export const onCronjob: OnCronjobHandler = async ({ request }) =>
  middleware.handle(async () => cronHandler.route(request));

export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) =>
  middleware.handle(async () => rpcHandler.route(origin, request));

export const onClientRequest: OnClientRequestHandler = async ({ request }) =>
  middleware.handle(async () => rpcHandler.route('metamask', request));

export const onKeyringRequest: OnKeyringRequestHandler = async ({
  origin,
  request,
}) => middleware.handle(async () => keyringHandler.route(origin, request));

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
