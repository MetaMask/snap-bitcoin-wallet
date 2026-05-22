import type { BitcoinAccount } from './account';

/**
 * Compute the spendable balance to display to the user, in satoshis.
 *
 * BDK's `Balance.trusted_spendable` only counts unconfirmed change UTXOs
 * landing on the *internal* keychain. When the snap fills a partner-supplied
 * PSBT (bridge/swap), the change output's script is dictated by the template
 * and typically drains to the user's *external* (public) address — so BDK
 * conservatively classifies that change as `untrusted_pending` and the user
 * sees their balance flash to zero until the tx confirms.
 *
 * We extend BDK's "trusted spendable" by also counting any unconfirmed UTXO
 * whose parent transaction was created by this wallet itself (i.e. spends
 * from one of our own inputs). Genuinely untrusted incoming unconfirmed
 * funds from third parties remain excluded.
 *
 * @param account - The Bitcoin account to inspect.
 * @returns The available balance in satoshis.
 */
export function computeDisplayBalanceSats(account: BitcoinAccount): bigint {
  let sats = account.balance.trusted_spendable.to_sat();

  for (const utxo of account.listUnspent()) {
    // Already counted by BDK as `trusted_pending` (change to internal keychain)
    // or as `confirmed` once anchored.
    if (utxo.keychain === 'internal') {
      continue;
    }

    const walletTx = account.getTransaction(utxo.outpoint.txid.toString());
    if (!walletTx || walletTx.chain_position.is_confirmed) {
      continue;
    }

    // `sent > 0` means the wallet contributed inputs to this transaction,
    // so the output landing back on our own external script is trusted —
    // a third party cannot have produced it without one of our keys.
    const [sent] = account.sentAndReceived(walletTx.tx);
    if (sent.to_sat() > 0n) {
      sats += utxo.txout.value.to_sat();
    }
  }

  return sats;
}
