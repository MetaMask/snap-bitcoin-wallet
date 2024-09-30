import { BtcOnChainService } from './bitcoin/chain';
import { QuickNodeClient } from './bitcoin/chain/clients/quicknode';
import { BtcAccountDeriver, BtcWallet, getBtcNetwork } from './bitcoin/wallet';
import { Config } from './config';

export class Factory {
  static createOnChainServiceProvider(scope: string): BtcOnChainService {
    const btcNetwork = getBtcNetwork(scope);

    const { mainnetEndpoint, testnetEndpoint } =
      Config.onChainService.dataClient.options;

    if (!mainnetEndpoint || !testnetEndpoint) {
      throw new Error('Invalid QuickNode endpoint');
    }

    const client = new QuickNodeClient({
      network: btcNetwork,
      mainnetEndpoint,
      testnetEndpoint,
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
