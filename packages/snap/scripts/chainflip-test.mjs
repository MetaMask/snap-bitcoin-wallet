#!/usr/bin/env node
/**
 * Usage:
 *   node packages/snap/scripts/chainflip-test.mjs
 */

import { SwapSDK, Chains, Assets } from '@chainflip/sdk/swap';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

const CONFIG = {
  network: 'mainnet',
  swapAmount: 100000,  // 0.001 BTC in satoshis
  destAddress: '0x1234567890123456789012345678901234567890',
  refundAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  changeAmount: 840,
};

const sdk = new SwapSDK({ network: CONFIG.network });

async function main() {
  try {
    console.log('\nGet Vault Swap Quote from Chainflip\n');
    const { quotes } = await sdk.getQuoteV2({
      srcChain: Chains.Bitcoin,
      srcAsset: Assets.BTC,
      destChain: Chains.Ethereum,
      destAsset: Assets.ETH,
      amount: String(CONFIG.swapAmount),
      isVaultSwap: true,
    });
    const quote = quotes[0];
    if (!quote) throw new Error('No quote available');
    const outputWei = BigInt(quote.egressAmount);
    const outputETH = Number(outputWei / BigInt(1e14)) / 10000;
    console.log(quote);
    console.log(`===>Swap: ${CONFIG.swapAmount / 1e8} BTC → ~${outputETH.toFixed(6)} ETH`);

    console.log('\nGet Vault Swap Data\n');
    const vaultData = await sdk.encodeVaultSwapData({
      quote,
      destAddress: CONFIG.destAddress,
      fillOrKillParams: {
        refundAddress: CONFIG.refundAddress,
        slippageTolerancePercent: '5',
        retryDurationBlocks: 100,
      },
    });
    if (vaultData.chain !== 'Bitcoin') {
      throw new Error('Expected Bitcoin vault data');
    }
    console.log(`Deposit Address: ${vaultData.depositAddress}`);
    console.log(`OP_RETURN length: ${(vaultData.nulldataPayload.length - 2) / 2} bytes`);

    console.log('\nBuild PSBT Template\n');

    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
    // Output 0: Deposit to Chainflip vault
    const depositScript = bitcoin.address.toOutputScript(
      vaultData.depositAddress, 
      bitcoin.networks.bitcoin
    );
    psbt.addOutput({
      script: depositScript,
      value: BigInt(CONFIG.swapAmount),
    });

    // Output 1: OP_RETURN with protocol metadata
    const nulldataHex = vaultData.nulldataPayload.startsWith('0x') 
      ? vaultData.nulldataPayload.slice(2) 
      : vaultData.nulldataPayload;
    const opReturnScript = bitcoin.script.compile([
      bitcoin.opcodes.OP_RETURN,
      Buffer.from(nulldataHex, 'hex'),
    ]);
    psbt.addOutput({
      script: opReturnScript,
      value: BigInt(0),
    });

    // Output 2: Change back to user
    const changeScript = bitcoin.address.toOutputScript(
      CONFIG.refundAddress,
      bitcoin.networks.bitcoin
    );
    psbt.addOutput({
      script: changeScript,
      value: BigInt(CONFIG.changeAmount),
    });

  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n(Chainflip API unavailable)\n');
  }
}

main();
