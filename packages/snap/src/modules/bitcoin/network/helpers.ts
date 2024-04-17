import { networks } from 'bitcoinjs-lib';

import { Network } from '../config';

export class NetworkHelper {
  static getNetwork(network: Network) {
    switch (network) {
      case Network.Mainnet:
        return networks.bitcoin;
      case Network.Testnet:
        return networks.testnet;
      default:
        throw new Error('Invalid network');
    }
  }
}
