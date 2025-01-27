import type { JsonSLIP10Node } from '@metamask/key-tree';
import { SLIP10Node } from '@metamask/key-tree';

import type { EntropyClient } from '../../entities/snap';

export class SnapEntropyClientAdapter implements EntropyClient {
  async getPrivateEntropy(derivationPath: string[]): Promise<JsonSLIP10Node> {
    return await snap.request({
      method: 'snap_getBip32Entropy',
      params: {
        path: derivationPath,
        curve: 'secp256k1',
      },
    });
  }

  async getPublicEntropy(derivationPath: string[]): Promise<SLIP10Node> {
    const slip10 = await this.getPrivateEntropy(derivationPath);
    return (await SLIP10Node.fromJSON(slip10)).neuter();
  }
}
