/**
 * Method to generate testing account.
 *
 * @param cnt - Number of accounts to generate.
 * @param addressPrefix - Prefix for the address.
 * @param idPrefix - Prefix for the id.
 * @returns Array of generated accounts.
 */
export function generateAccounts(cnt = 1, addressPrefix = '', idPrefix = '') {
  const accounts: any[] = [];
  let baseAddress = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';
  let baseUUID = '1b9d6bcd-bbfd-4b2d-9b5d-abadfbbdcbed';

  baseAddress =
    addressPrefix + baseAddress.slice(addressPrefix.length, baseAddress.length);
  baseUUID = idPrefix + baseUUID.slice(idPrefix.length, baseUUID.length);

  for (let i = 0; i < cnt; i++) {
    const hdPath = [`m`, `0'`, `0`, `${i}`].join('/');
    accounts.push({
      type: 'bip32',
      id:
        baseUUID.slice(0, baseUUID.length - i.toString().length) + i.toString(),
      address:
        baseAddress.slice(0, baseAddress.length - i.toString().length) +
        i.toString(),
      options: {
        hdPath,
        index: i,
        type: 'P2WPKH',
      },
      methods: [],
    });
  }

  return accounts;
}
