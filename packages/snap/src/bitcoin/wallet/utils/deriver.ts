import type { BIP32Interface } from 'bip32';

/**
 * Derives a new BIP32Interface object using an HD path.
 *
 * @param rootNode - The root BIP32Interface object that derived from.
 * @param path - The HD path, e.g. ["m","0'","0"].
 * @returns A new BIP32Interface object derived by the given path.
 */
export function deriveByPath(
  rootNode: BIP32Interface,
  path: string[],
): BIP32Interface {
  let _path: string[] = path;
  if (_path[0] === 'm') {
    _path = _path.slice(1);
  }
  return _path.reduce((prevHd: BIP32Interface, indexStr: string) => {
    const isHardened = indexStr.endsWith(`'`);
    let _indexStr = indexStr;

    if (isHardened) {
      _indexStr = _indexStr.slice(0, -1);
    }

    if (!/^\d+$/u.test(_indexStr)) {
      throw new Error(`Invalid index`);
    }

    const index = parseInt(_indexStr, 10);
    return isHardened ? prevHd.deriveHardened(index) : prevHd.derive(index);
  }, rootNode);
}
