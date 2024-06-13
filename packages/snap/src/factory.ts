import { BtcOnChainService } from './bitcoin/chain';
import { BlockChairClient } from './bitcoin/chain/clients/blockchair';
import { BtcAccountDeriver, BtcWallet, getBtcNetwork } from './bitcoin/wallet';
import { Config } from './config';

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

  static createWallet(scope: string): BtcWallet {
    const btcNetwork = getBtcNetwork(scope);
    return new BtcWallet(new BtcAccountDeriver(btcNetwork), btcNetwork);
  }
}
