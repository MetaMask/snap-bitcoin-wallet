import { CustomError } from '../exception';

export class SnapRpcError extends CustomError {}
export class InvalidSnapRpcResponseError extends SnapRpcError {}
