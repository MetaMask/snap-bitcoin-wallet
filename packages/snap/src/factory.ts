import { BtcOnChainService } from './bitcoin/chain';
import { BlockChairClient } from './bitcoin/chain/clients/blockchair';
import { getBtcNetwork } from './bitcoin/utils';
import { BtcAccountDeriver, BtcWallet } from './bitcoin/wallet';
import { Config } from './config';
import type { IWallet } from './wallet';

export class Factory {
  static createOnChainServiceProvider(scope: string): BtcOnChainService {
    const btcNetwork = getBtcNetwork(scope);

    const client = new BlockChairClient({
      network: btcNetwork,
      apiKey: Config.onChainService.dataClient.options?.apiKey?.toString(),
    });

    return new BtcOnChainService(client, {
      network: btcNetwork,
    });
  }

  static createWallet(scope: string): IWallet {
    const btcNetwork = getBtcNetwork(scope);
    return new BtcWallet(new BtcAccountDeriver(btcNetwork), btcNetwork);
  }
}
