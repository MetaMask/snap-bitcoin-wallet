import type { Network } from '@bitcoindevkit/bdk-wallet-web';
import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Image } from '@metamask/snaps-sdk/jsx';

import btcIconInline from '../images/bitcoin-inline.svg';
import signetIcon from '../images/signet.svg';
import testnetIcon from '../images/testnet.svg';

const networkToIcon: Record<Network, string> = {
  bitcoin: btcIconInline,
  testnet: testnetIcon,
  testnet4: testnetIcon,
  signet: signetIcon,
  regtest: signetIcon,
};

export type AssetIconInlineProps = {
  network: Network;
  variant?: 'asset' | 'network';
};

export const AssetIconInline: SnapComponent<AssetIconInlineProps> = ({
  network,
  variant = 'asset',
}) => (
  <Image
    borderRadius={variant === 'network' ? 'medium' : 'full'}
    src={networkToIcon[network]}
  />
);
