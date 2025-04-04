import type {
  OnAssetsConversionHandler,
  OnAssetsLookupHandler,
  OnCronjobHandler,
  OnRpcRequestHandler,
  OnKeyringRequestHandler,
  OnUserInputHandler,
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
  SimpleHashClientAdapter,
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
const metaProtocolsClient = new SimpleHashClientAdapter(Config.simpleHash);
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
  metaProtocolsClient,
  Config.accounts,
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
const keyringHandler = new KeyringHandler(accountsUseCases);
const cronHandler = new CronHandler(logger, accountsUseCases, sendFlowUseCases);
const rpcHandler = new RpcHandler(sendFlowUseCases, accountsUseCases);
const userInputHandler = new UserInputHandler(sendFlowUseCases);
const assetsHandler = new AssetsHandler(
  assetsUseCases,
  Config.conversionsExpirationInterval,
);

export const onCronjob: OnCronjobHandler = async (args) =>
  cronHandler.route(args);
export const onRpcRequest: OnRpcRequestHandler = async (args) =>
  rpcHandler.route(args);
export const onKeyringRequest: OnKeyringRequestHandler = async (args) =>
  keyringHandler.route(args);
export const onUserInput: OnUserInputHandler = async (args) =>
  userInputHandler.route(args);
export const onAssetsLookup: OnAssetsLookupHandler = async (_) =>
  assetsHandler.lookup();
export const onAssetsConversion: OnAssetsConversionHandler = async (args) =>
  assetsHandler.conversion(args);
