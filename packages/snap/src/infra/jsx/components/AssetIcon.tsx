import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import { Box, Image } from '@metamask/snaps-sdk/jsx';
import type { Network } from 'bitcoindevkit';

import btcIcon from '../images/bitcoin.svg';
import signetIcon from '../images/signet.svg';
import testnetIcon from '../images/testnet.svg';

const networkToIcon: Record<Network, string> = {
  bitcoin: btcIcon,
  testnet: testnetIcon,
  testnet4: testnetIcon,
  signet: signetIcon,
  regtest: signetIcon,
};

export type AssetIconProps = {
  network: Network;
};

export const AssetIcon: SnapComponent<AssetIconProps> = ({ network }) => (
  <Box direction="horizontal" center>
    <Image src={networkToIcon[network]} />
  </Box>
);
