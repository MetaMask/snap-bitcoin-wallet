import { CustomError } from '../../utils';

export class DeriverError extends CustomError {}

export class WalletFactoryError extends CustomError {}

export class WalletError extends CustomError {}

export class TxValidationError extends WalletError {}

export class PsbtServiceError extends CustomError {}

export class PsbtSigValidateError extends CustomError {}

export class PsbtValidateError extends CustomError {}

export class PsbtUpdateWithnessUtxoError extends CustomError {}
