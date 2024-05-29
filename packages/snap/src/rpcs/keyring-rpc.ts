import { Factory } from '../factory';
import { type Wallet as WalletData } from '../keyring';
import { BaseSnapRpcHandler } from '../modules/rpc';
import type { SnapRpcHandlerRequest } from '../modules/rpc';
import type { IAccount, IWallet } from '../wallet';

export abstract class KeyringRpcHandler extends BaseSnapRpcHandler {
  walletData: WalletData;

  wallet: IWallet;

  walletAccount: IAccount;

  protected override async preExecute(
    params: SnapRpcHandlerRequest,
  ): Promise<void> {
    await super.preExecute(params);

    const { scope, index, account } = this.walletData;
    const wallet = Factory.createWallet(scope);
    const unlocked = await wallet.unlock(index, account.type);

    if (!unlocked || unlocked.address !== account.address) {
      throw new Error('Account not found');
    }

    this.walletAccount = unlocked;
    this.wallet = wallet;
  }
}
