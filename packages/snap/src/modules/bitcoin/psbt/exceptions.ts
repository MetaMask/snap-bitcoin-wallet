import { CustomError } from '../../exception';

export class PsbtServiceError extends CustomError {}
export class PsbtSigValidateError extends CustomError {}
export class PsbtValidateError extends CustomError {}
export class PsbtUpdateWithnessUtxoError extends CustomError {}
