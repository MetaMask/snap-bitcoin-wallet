import { BtcOnChainService } from './bitcoin/chain';
import { QuickNodeClient } from './bitcoin/chain/clients/quicknode';
import { SimpleHashClient } from './bitcoin/chain/clients/simplehash';
import { BtcAccountDeriver, BtcWallet, getBtcNetwork } from './bitcoin/wallet';
import { ApiClient, Config } from './config';

export class Factory {
  static createOnChainServiceProvider(scope: string): BtcOnChainService {
    const btcNetwork = getBtcNetwork(scope);

    const quickNodeClient = Factory.createQuickNodeClient(scope);
    const simpleHashClient = Factory.createSimpleHashClient();

    return new BtcOnChainService(
      {
        dataClient: quickNodeClient,
        satsProtectionDataClient: simpleHashClient,
      },
      {
        network: btcNetwork,
        // Sats Protection is enabled by default.
        satsProtection: Config.defaultSatsProtectionEnabled,
      },
    );
  }

  static createQuickNodeClient(scope: string): QuickNodeClient {
    const btcNetwork = getBtcNetwork(scope);

    const { mainnetEndpoint, testnetEndpoint } =
      Config.onChainService.apiClient[ApiClient.QuickNode].options;

    if (!mainnetEndpoint || !testnetEndpoint) {
      throw new Error('QuickNode endpoints have not been configured');
    }

    return new QuickNodeClient({
      network: btcNetwork,
      mainnetEndpoint,
      testnetEndpoint,
    });
  }

  static createSimpleHashClient(): SimpleHashClient {
    const { apiKey } =
      Config.onChainService.apiClient[ApiClient.SimpleHash].options;

    if (!apiKey) {
      throw new Error('Simplehash API key has not been configured');
    }

    return new SimpleHashClient({
      apiKey,
    });
  }

  static createWallet(scope: string): BtcWallet {
    const btcNetwork = getBtcNetwork(scope);
    return new BtcWallet(new BtcAccountDeriver(btcNetwork), btcNetwork);
  }
}
