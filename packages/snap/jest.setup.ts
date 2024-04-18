import { WalletMock } from './test/wallet.mock.test';

// eslint-disable-next-line no-restricted-globals
const globalAny: any = global;

globalAny.snap = new WalletMock();
globalAny.fetch = jest.fn();
