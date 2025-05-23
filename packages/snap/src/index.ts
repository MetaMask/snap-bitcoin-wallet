import type {
  OnAssetsConversionHandler,
  OnAssetsLookupHandler,
  OnCronjobHandler,
  OnRpcRequestHandler,
  OnKeyringRequestHandler,
  OnUserInputHandler,
  OnAssetHistoricalPriceHandler,
  OnInstallHandler,
} from '@metamask/snaps-sdk';

import { Config } from './config';
import {
  KeyringHandler,
  CronHandler,
  UserInputHandler,
  RpcHandler,
  AssetsHandler,
} from './handlers';
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

// Data layer
const accountRepository = new BdkAccountRepository(snapClient);
const sendFlowRepository = new JSXSendFlowRepository(snapClient, translator);

// Business layer
const accountsUseCases = new AccountUseCases(
  logger,
  snapClient,
  accountRepository,
  chainClient,
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

export const onInstall: OnInstallHandler = async () => {
  await snapClient.initState();
  logger.info('Snap installed');
};

export const onCronjob: OnCronjobHandler = async ({ request }) =>
  cronHandler.route(request);

export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) =>
  rpcHandler.route(origin, request);

export const onKeyringRequest: OnKeyringRequestHandler = async ({
  origin,
  request,
}) => keyringHandler.route(origin, request);

export const onUserInput: OnUserInputHandler = async ({ id, event, context }) =>
  userInputHandler.route(id, event, context);

export const onAssetsLookup: OnAssetsLookupHandler = async () =>
  assetsHandler.lookup();

export const onAssetsConversion: OnAssetsConversionHandler = async ({
  conversions,
}) => assetsHandler.conversion(conversions);

export const onAssetHistoricalPrice: OnAssetHistoricalPriceHandler = async ({
  from,
  to,
}) => assetsHandler.historicalPrice(from, to);
