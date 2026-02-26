export const getRequiredOutpoint = (utxos: { outpoint?: string }[]): string => {
  const outpoint = utxos[0]?.outpoint;
  if (!outpoint) {
    throw new Error('Expected at least one UTXO with outpoint');
  }
  return outpoint;
};
