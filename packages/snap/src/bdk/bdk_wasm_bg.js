let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}


const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let WASM_VECTOR_LEN = 0;

const lTextEncoder = typeof TextEncoder === 'undefined' ? (0, module.require)('util').TextEncoder : TextEncoder;

let cachedTextEncoder = new lTextEncoder('utf-8');

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => {
    wasm.__wbindgen_export_3.get(state.dtor)(state.a, state.b)
});

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_3.get(state.dtor)(a, state.b);
                CLOSURE_DTORS.unregister(state);
            } else {
                state.a = a;
            }
        }
    };
    real.original = state;
    CLOSURE_DTORS.register(real, state, state);
    return real;
}
function __wbg_adapter_52(arg0, arg1, arg2) {
    wasm.closure753_externref_shim(arg0, arg1, arg2);
}

function __wbg_adapter_55(arg0, arg1) {
    wasm._dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h181f615f2ab935e8(arg0, arg1);
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_export_2.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_2.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}
/**
 * @param {string} mnemonic
 * @param {string} passphrase
 * @param {Network} network
 * @param {AddressType} address_type
 * @returns {DescriptorPair}
 */
export function mnemonic_to_descriptor(mnemonic, passphrase, network, address_type) {
    const ptr0 = passStringToWasm0(mnemonic, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(passphrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.mnemonic_to_descriptor(ptr0, len0, ptr1, len1, network, address_type);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return DescriptorPair.__wrap(ret[0]);
}

/**
 * @param {string} extended_privkey
 * @param {string} fingerprint
 * @param {Network} network
 * @param {AddressType} address_type
 * @returns {DescriptorPair}
 */
export function xpriv_to_descriptor(extended_privkey, fingerprint, network, address_type) {
    const ptr0 = passStringToWasm0(extended_privkey, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(fingerprint, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.xpriv_to_descriptor(ptr0, len0, ptr1, len1, network, address_type);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return DescriptorPair.__wrap(ret[0]);
}

/**
 * @param {string} extended_pubkey
 * @param {string} fingerprint
 * @param {Network} network
 * @param {AddressType} address_type
 * @returns {DescriptorPair}
 */
export function xpub_to_descriptor(extended_pubkey, fingerprint, network, address_type) {
    const ptr0 = passStringToWasm0(extended_pubkey, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(fingerprint, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.xpub_to_descriptor(ptr0, len0, ptr1, len1, network, address_type);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return DescriptorPair.__wrap(ret[0]);
}

/**
 * @param {string} mnemonic
 * @param {string} passphrase
 * @param {Network} network
 * @returns {string}
 */
export function mnemonic_to_xpriv(mnemonic, passphrase, network) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(mnemonic, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(passphrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.mnemonic_to_xpriv(ptr0, len0, ptr1, len1, network);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * @param {any} slip10
 * @param {Network} network
 * @returns {string}
 */
export function slip10_to_extended(slip10, network) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ret = wasm.slip10_to_extended(slip10, network);
        var ptr1 = ret[0];
        var len1 = ret[1];
        if (ret[3]) {
            ptr1 = 0; len1 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred2_0 = ptr1;
        deferred2_1 = len1;
        return getStringFromWasm0(ptr1, len1);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

function notDefined(what) { return () => { throw new Error(`${what} is not defined`); }; }

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_2.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}
function __wbg_adapter_205(arg0, arg1, arg2, arg3) {
    wasm.closure1223_externref_shim(arg0, arg1, arg2, arg3);
}

/**
 * The different types of addresses.
 */
export const AddressType = Object.freeze({
/**
 * Pay to pubkey hash.
 */
P2pkh:0,"0":"P2pkh",
/**
 * Pay to script hash.
 */
P2sh:1,"1":"P2sh",
/**
 * Pay to witness pubkey hash.
 */
P2wpkh:2,"2":"P2wpkh",
/**
 * Pay to taproot.
 */
P2tr:3,"3":"P2tr", });
/**
 * Types of keychains
 */
export const KeychainKind = Object.freeze({
/**
 * External keychain, used for deriving recipient addresses.
 */
External:0,"0":"External",
/**
 * Internal keychain, used for deriving change addresses.
 */
Internal:1,"1":"Internal", });
/**
 * The cryptocurrency network to act on.
 */
export const Network = Object.freeze({
/**
 * Mainnet Bitcoin.
 */
Bitcoin:0,"0":"Bitcoin",
/**
 * Bitcoin's testnet network.
 */
Testnet:1,"1":"Testnet",
/**
 * Bitcoin's testnet4 network.
 */
Testnet4:2,"2":"Testnet4",
/**
 * Bitcoin's signet network.
 */
Signet:3,"3":"Signet",
/**
 * Bitcoin's regtest network.
 */
Regtest:4,"4":"Regtest", });

const __wbindgen_enum_RequestCredentials = ["omit", "same-origin", "include"];

const __wbindgen_enum_RequestMode = ["same-origin", "no-cors", "cors", "navigate"];

const AddressInfoFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_addressinfo_free(ptr >>> 0, 1));
/**
 * A derived address and the index it was found at.
 */
export class AddressInfo {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(AddressInfo.prototype);
        obj.__wbg_ptr = ptr;
        AddressInfoFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AddressInfoFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_addressinfo_free(ptr, 0);
    }
    /**
     * Child index of this address
     * @returns {number}
     */
    get index() {
        const ret = wasm.addressinfo_index(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Address
     * @returns {string}
     */
    get address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.addressinfo_address(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Type of keychain
     * @returns {KeychainKind}
     */
    get keychain() {
        const ret = wasm.addressinfo_keychain(this.__wbg_ptr);
        return ret;
    }
    /**
     * Type of keychain
     * @returns {AddressType | undefined}
     */
    get address_type() {
        const ret = wasm.addressinfo_address_type(this.__wbg_ptr);
        return ret === 4 ? undefined : ret;
    }
}

const BalanceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_balance_free(ptr >>> 0, 1));
/**
 * Balance, differentiated into various categories.
 */
export class Balance {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Balance.prototype);
        obj.__wbg_ptr = ptr;
        BalanceFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BalanceFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_balance_free(ptr, 0);
    }
    /**
     * All coinbase outputs not yet matured
     * @returns {bigint}
     */
    get immature() {
        const ret = wasm.balance_immature(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Unconfirmed UTXOs generated by a wallet tx
     * @returns {bigint}
     */
    get trusted_pending() {
        const ret = wasm.balance_trusted_pending(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Unconfirmed UTXOs received from an external wallet
     * @returns {bigint}
     */
    get untrusted_pending() {
        const ret = wasm.balance_untrusted_pending(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Confirmed and immediately spendable balance
     * @returns {bigint}
     */
    get confirmed() {
        const ret = wasm.balance_confirmed(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Get sum of trusted_pending and confirmed coins.
     *
     * This is the balance you can spend right now that shouldn't get cancelled via another party
     * double spending it.
     * @returns {bigint}
     */
    get trusted_spendable() {
        const ret = wasm.balance_trusted_spendable(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Get the whole balance visible to the wallet.
     * @returns {bigint}
     */
    get total() {
        const ret = wasm.balance_total(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
}

const DescriptorPairFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_descriptorpair_free(ptr >>> 0, 1));
/**
 * Pair of descriptors for external and internal keychains
 */
export class DescriptorPair {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(DescriptorPair.prototype);
        obj.__wbg_ptr = ptr;
        DescriptorPairFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DescriptorPairFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_descriptorpair_free(ptr, 0);
    }
    /**
     * @param {string} external
     * @param {string} internal
     */
    constructor(external, internal) {
        const ptr0 = passStringToWasm0(external, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(internal, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.descriptorpair_new(ptr0, len0, ptr1, len1);
        this.__wbg_ptr = ret >>> 0;
        DescriptorPairFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {string}
     */
    get internal() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.descriptorpair_internal(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    get external() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.descriptorpair_external(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}

const EsploraMMWalletFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_esplorammwallet_free(ptr >>> 0, 1));

export class EsploraMMWallet {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(EsploraMMWallet.prototype);
        obj.__wbg_ptr = ptr;
        EsploraMMWalletFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EsploraMMWalletFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_esplorammwallet_free(ptr, 0);
    }
    /**
     * @param {Network} network
     * @param {string} external_descriptor
     * @param {string} internal_descriptor
     * @param {string} url
     * @returns {Promise<EsploraMMWallet>}
     */
    static new(network, external_descriptor, internal_descriptor, url) {
        const ptr0 = passStringToWasm0(external_descriptor, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(internal_descriptor, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.esplorammwallet_new(network, ptr0, len0, ptr1, len1, ptr2, len2);
        return ret;
    }
    /**
     * @param {number} stop_gap
     * @param {number} parallel_requests
     * @returns {Promise<void>}
     */
    full_scan(stop_gap, parallel_requests) {
        const ret = wasm.esplorammwallet_full_scan(this.__wbg_ptr, stop_gap, parallel_requests);
        return ret;
    }
    /**
     * @param {number} parallel_requests
     * @returns {Promise<void>}
     */
    sync(parallel_requests) {
        const ret = wasm.esplorammwallet_sync(this.__wbg_ptr, parallel_requests);
        return ret;
    }
    /**
     * @returns {bigint}
     */
    balance() {
        const ret = wasm.esplorammwallet_balance(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @param {KeychainKind} keychain
     * @returns {AddressInfo}
     */
    next_unused_address(keychain) {
        const ret = wasm.esplorammwallet_next_unused_address(this.__wbg_ptr, keychain);
        return AddressInfo.__wrap(ret);
    }
    /**
     * @param {KeychainKind} keychain
     * @param {number} index
     * @returns {AddressInfo}
     */
    peek_address(keychain, index) {
        const ret = wasm.esplorammwallet_peek_address(this.__wbg_ptr, keychain, index);
        return AddressInfo.__wrap(ret);
    }
    /**
     * @param {KeychainKind} keychain
     * @returns {AddressInfo}
     */
    reveal_next_address(keychain) {
        const ret = wasm.esplorammwallet_reveal_next_address(this.__wbg_ptr, keychain);
        return AddressInfo.__wrap(ret);
    }
    /**
     * @param {KeychainKind} keychain
     * @returns {(AddressInfo)[]}
     */
    list_unused_addresses(keychain) {
        const ret = wasm.esplorammwallet_list_unused_addresses(this.__wbg_ptr, keychain);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {any}
     */
    take_staged() {
        const ret = wasm.esplorammwallet_take_staged(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {string} block_hash
     * @returns {Promise<any>}
     */
    get_block_by_hash(block_hash) {
        const ptr0 = passStringToWasm0(block_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.esplorammwallet_get_block_by_hash(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * @returns {Promise<boolean>}
     */
    persist() {
        const ret = wasm.esplorammwallet_persist(this.__wbg_ptr);
        return ret;
    }
}

const EsploraWalletFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_esplorawallet_free(ptr >>> 0, 1));

export class EsploraWallet {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(EsploraWallet.prototype);
        obj.__wbg_ptr = ptr;
        EsploraWalletFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EsploraWalletFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_esplorawallet_free(ptr, 0);
    }
    /**
     * @param {Network} network
     * @param {string} external_descriptor
     * @param {string} internal_descriptor
     * @param {string} url
     * @returns {EsploraWallet}
     */
    static from_descriptors(network, external_descriptor, internal_descriptor, url) {
        const ptr0 = passStringToWasm0(external_descriptor, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(internal_descriptor, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.esplorawallet_from_descriptors(network, ptr0, len0, ptr1, len1, ptr2, len2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return EsploraWallet.__wrap(ret[0]);
    }
    /**
     * @param {string} mnemonic
     * @param {string} passphrase
     * @param {Network} network
     * @param {AddressType} address_type
     * @param {string} url
     * @returns {EsploraWallet}
     */
    static from_mnemonic(mnemonic, passphrase, network, address_type, url) {
        const ptr0 = passStringToWasm0(mnemonic, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(passphrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.esplorawallet_from_mnemonic(ptr0, len0, ptr1, len1, network, address_type, ptr2, len2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return EsploraWallet.__wrap(ret[0]);
    }
    /**
     * @param {string} extended_privkey
     * @param {string} fingerprint
     * @param {Network} network
     * @param {AddressType} address_type
     * @param {string} url
     * @returns {EsploraWallet}
     */
    static from_xpriv(extended_privkey, fingerprint, network, address_type, url) {
        const ptr0 = passStringToWasm0(extended_privkey, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(fingerprint, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.esplorawallet_from_xpriv(ptr0, len0, ptr1, len1, network, address_type, ptr2, len2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return EsploraWallet.__wrap(ret[0]);
    }
    /**
     * @param {string} extended_pubkey
     * @param {string} fingerprint
     * @param {Network} network
     * @param {AddressType} address_type
     * @param {string} url
     * @returns {EsploraWallet}
     */
    static from_xpub(extended_pubkey, fingerprint, network, address_type, url) {
        const ptr0 = passStringToWasm0(extended_pubkey, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(fingerprint, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.esplorawallet_from_xpub(ptr0, len0, ptr1, len1, network, address_type, ptr2, len2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return EsploraWallet.__wrap(ret[0]);
    }
    /**
     * @param {any} changeset
     * @param {string} url
     * @returns {EsploraWallet}
     */
    static load(changeset, url) {
        const ptr0 = passStringToWasm0(url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.esplorawallet_load(changeset, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return EsploraWallet.__wrap(ret[0]);
    }
    /**
     * @param {number} stop_gap
     * @param {number} parallel_requests
     * @returns {Promise<void>}
     */
    full_scan(stop_gap, parallel_requests) {
        const ret = wasm.esplorawallet_full_scan(this.__wbg_ptr, stop_gap, parallel_requests);
        return ret;
    }
    /**
     * @param {number} parallel_requests
     * @returns {Promise<void>}
     */
    sync(parallel_requests) {
        const ret = wasm.esplorawallet_sync(this.__wbg_ptr, parallel_requests);
        return ret;
    }
    /**
     * @returns {Network}
     */
    network() {
        const ret = wasm.esplorawallet_network(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Balance}
     */
    balance() {
        const ret = wasm.esplorawallet_balance(this.__wbg_ptr);
        return Balance.__wrap(ret);
    }
    /**
     * @param {KeychainKind} keychain
     * @returns {AddressInfo}
     */
    next_unused_address(keychain) {
        const ret = wasm.esplorawallet_next_unused_address(this.__wbg_ptr, keychain);
        return AddressInfo.__wrap(ret);
    }
    /**
     * @param {KeychainKind} keychain
     * @param {number} index
     * @returns {AddressInfo}
     */
    peek_address(keychain, index) {
        const ret = wasm.esplorawallet_peek_address(this.__wbg_ptr, keychain, index);
        return AddressInfo.__wrap(ret);
    }
    /**
     * @param {KeychainKind} keychain
     * @returns {AddressInfo}
     */
    reveal_next_address(keychain) {
        const ret = wasm.esplorawallet_reveal_next_address(this.__wbg_ptr, keychain);
        return AddressInfo.__wrap(ret);
    }
    /**
     * @param {KeychainKind} keychain
     * @param {number} index
     * @returns {(AddressInfo)[]}
     */
    reveal_addresses_to(keychain, index) {
        const ret = wasm.esplorawallet_reveal_addresses_to(this.__wbg_ptr, keychain, index);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {KeychainKind} keychain
     * @returns {(AddressInfo)[]}
     */
    list_unused_addresses(keychain) {
        const ret = wasm.esplorawallet_list_unused_addresses(this.__wbg_ptr, keychain);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {any[]}
     */
    list_unspent() {
        const ret = wasm.esplorawallet_list_unspent(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {any[]}
     */
    transactions() {
        const ret = wasm.esplorawallet_transactions(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {any}
     */
    take_staged() {
        const ret = wasm.esplorawallet_take_staged(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {string} block_hash
     * @returns {Promise<any>}
     */
    get_block_by_hash(block_hash) {
        const ptr0 = passStringToWasm0(block_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.esplorawallet_get_block_by_hash(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
}

export const __wbg_request_f6a41be736fe6eb3 = typeof snap.request == 'function' ? snap.request : notDefined('snap.request');

export function __wbindgen_error_new(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return ret;
};

export function __wbg_esplorammwallet_new(arg0) {
    const ret = EsploraMMWallet.__wrap(arg0);
    return ret;
};

export function __wbg_addressinfo_new(arg0) {
    const ret = AddressInfo.__wrap(arg0);
    return ret;
};

export function __wbindgen_number_new(arg0) {
    const ret = arg0;
    return ret;
};

export function __wbindgen_number_get(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'number' ? obj : undefined;
    getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
};

export function __wbindgen_string_get(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'string' ? obj : undefined;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

export function __wbindgen_as_number(arg0) {
    const ret = +arg0;
    return ret;
};

export function __wbindgen_string_new(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
};

export function __wbindgen_is_undefined(arg0) {
    const ret = arg0 === undefined;
    return ret;
};

export function __wbindgen_in(arg0, arg1) {
    const ret = arg0 in arg1;
    return ret;
};

export function __wbindgen_boolean_get(arg0) {
    const v = arg0;
    const ret = typeof(v) === 'boolean' ? (v ? 1 : 0) : 2;
    return ret;
};

export function __wbindgen_is_bigint(arg0) {
    const ret = typeof(arg0) === 'bigint';
    return ret;
};

export function __wbindgen_bigint_from_i64(arg0) {
    const ret = arg0;
    return ret;
};

export function __wbindgen_jsval_eq(arg0, arg1) {
    const ret = arg0 === arg1;
    return ret;
};

export function __wbindgen_is_object(arg0) {
    const val = arg0;
    const ret = typeof(val) === 'object' && val !== null;
    return ret;
};

export function __wbindgen_bigint_from_u64(arg0) {
    const ret = BigInt.asUintN(64, arg0);
    return ret;
};

export function __wbindgen_is_string(arg0) {
    const ret = typeof(arg0) === 'string';
    return ret;
};

export function __wbindgen_jsval_loose_eq(arg0, arg1) {
    const ret = arg0 == arg1;
    return ret;
};

export function __wbg_String_b9412f8799faab3e(arg0, arg1) {
    const ret = String(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

export function __wbg_getwithrefkey_edc2c8960f0f1191(arg0, arg1) {
    const ret = arg0[arg1];
    return ret;
};

export function __wbg_set_f975102236d3c502(arg0, arg1, arg2) {
    arg0[arg1] = arg2;
};

export const __wbg_fetch_bc7c8e27076a5c84 = typeof fetch == 'function' ? fetch : notDefined('fetch');

export function __wbg_fetch_1fdc4448ed9eec00(arg0, arg1) {
    const ret = arg0.fetch(arg1);
    return ret;
};

export function __wbg_newwithstrandinit_4b92c89af0a8e383() { return handleError(function (arg0, arg1, arg2) {
    const ret = new Request(getStringFromWasm0(arg0, arg1), arg2);
    return ret;
}, arguments) };

export function __wbg_setbody_aa8b691bec428bf4(arg0, arg1) {
    arg0.body = arg1;
};

export function __wbg_setcredentials_a4e661320cdb9738(arg0, arg1) {
    arg0.credentials = __wbindgen_enum_RequestCredentials[arg1];
};

export function __wbg_setheaders_f5205d36e423a544(arg0, arg1) {
    arg0.headers = arg1;
};

export function __wbg_setmethod_ce2da76000b02f6a(arg0, arg1, arg2) {
    arg0.method = getStringFromWasm0(arg1, arg2);
};

export function __wbg_setmode_4919fd636102c586(arg0, arg1) {
    arg0.mode = __wbindgen_enum_RequestMode[arg1];
};

export function __wbg_setsignal_812ccb8269a7fd90(arg0, arg1) {
    arg0.signal = arg1;
};

export function __wbg_signal_9acfcec9e7dffc22(arg0) {
    const ret = arg0.signal;
    return ret;
};

export function __wbg_new_75169ae5a9683c55() { return handleError(function () {
    const ret = new AbortController();
    return ret;
}, arguments) };

export function __wbg_abort_c57daab47a6c1215(arg0) {
    arg0.abort();
};

export function __wbg_new_a9ae04a5200606a5() { return handleError(function () {
    const ret = new Headers();
    return ret;
}, arguments) };

export function __wbg_append_8b3e7f74a47ea7d5() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
    arg0.append(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
}, arguments) };

export function __wbg_instanceof_Response_3c0e210a57ff751d(arg0) {
    let result;
    try {
        result = arg0 instanceof Response;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
};

export function __wbg_url_58af972663531d16(arg0, arg1) {
    const ret = arg1.url;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

export function __wbg_status_5f4e900d22140a18(arg0) {
    const ret = arg0.status;
    return ret;
};

export function __wbg_headers_1b9bf90c73fae600(arg0) {
    const ret = arg0.headers;
    return ret;
};

export function __wbg_arrayBuffer_144729e09879650e() { return handleError(function (arg0) {
    const ret = arg0.arrayBuffer();
    return ret;
}, arguments) };

export function __wbg_text_ebeee8b31af4c919() { return handleError(function (arg0) {
    const ret = arg0.text();
    return ret;
}, arguments) };

export function __wbg_queueMicrotask_848aa4969108a57e(arg0) {
    const ret = arg0.queueMicrotask;
    return ret;
};

export function __wbindgen_is_function(arg0) {
    const ret = typeof(arg0) === 'function';
    return ret;
};

export function __wbindgen_cb_drop(arg0) {
    const obj = arg0.original;
    if (obj.cnt-- == 1) {
        obj.a = 0;
        return true;
    }
    const ret = false;
    return ret;
};

export const __wbg_queueMicrotask_c5419c06eab41e73 = typeof queueMicrotask == 'function' ? queueMicrotask : notDefined('queueMicrotask');

export const __wbg_clearTimeout_541ac0980ffcef74 = typeof clearTimeout == 'function' ? clearTimeout : notDefined('clearTimeout');

export function __wbg_setTimeout_7d81d052875b0f4f() { return handleError(function (arg0, arg1) {
    const ret = setTimeout(arg0, arg1);
    return ret;
}, arguments) };

export function __wbg_get_5419cf6b954aa11d(arg0, arg1) {
    const ret = arg0[arg1 >>> 0];
    return ret;
};

export function __wbg_length_f217bbbf7e8e4df4(arg0) {
    const ret = arg0.length;
    return ret;
};

export function __wbg_new_034f913e7636e987() {
    const ret = new Array();
    return ret;
};

export function __wbg_newnoargs_1ede4bf2ebbaaf43(arg0, arg1) {
    const ret = new Function(getStringFromWasm0(arg0, arg1));
    return ret;
};

export function __wbg_new_7a87a0376e40533b() {
    const ret = new Map();
    return ret;
};

export function __wbg_next_13b477da1eaa3897(arg0) {
    const ret = arg0.next;
    return ret;
};

export function __wbg_next_b06e115d1b01e10b() { return handleError(function (arg0) {
    const ret = arg0.next();
    return ret;
}, arguments) };

export function __wbg_done_983b5ffcaec8c583(arg0) {
    const ret = arg0.done;
    return ret;
};

export function __wbg_value_2ab8a198c834c26a(arg0) {
    const ret = arg0.value;
    return ret;
};

export function __wbg_iterator_695d699a44d6234c() {
    const ret = Symbol.iterator;
    return ret;
};

export function __wbg_get_ef828680c64da212() { return handleError(function (arg0, arg1) {
    const ret = Reflect.get(arg0, arg1);
    return ret;
}, arguments) };

export function __wbg_call_a9ef466721e824f2() { return handleError(function (arg0, arg1) {
    const ret = arg0.call(arg1);
    return ret;
}, arguments) };

export function __wbg_new_e69b5f66fda8f13c() {
    const ret = new Object();
    return ret;
};

export function __wbg_self_bf91bf94d9e04084() { return handleError(function () {
    const ret = self.self;
    return ret;
}, arguments) };

export function __wbg_window_52dd9f07d03fd5f8() { return handleError(function () {
    const ret = window.window;
    return ret;
}, arguments) };

export function __wbg_globalThis_05c129bf37fcf1be() { return handleError(function () {
    const ret = globalThis.globalThis;
    return ret;
}, arguments) };

export function __wbg_global_3eca19bb09e9c484() { return handleError(function () {
    const ret = global.global;
    return ret;
}, arguments) };

export function __wbg_set_425e70f7c64ac962(arg0, arg1, arg2) {
    arg0[arg1 >>> 0] = arg2;
};

export function __wbg_isArray_6f3b47f09adb61b5(arg0) {
    const ret = Array.isArray(arg0);
    return ret;
};

export function __wbg_instanceof_ArrayBuffer_74945570b4a62ec7(arg0) {
    let result;
    try {
        result = arg0 instanceof ArrayBuffer;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
};

export function __wbg_call_3bfa248576352471() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.call(arg1, arg2);
    return ret;
}, arguments) };

export function __wbg_instanceof_Map_f96986929e7e89ed(arg0) {
    let result;
    try {
        result = arg0 instanceof Map;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
};

export function __wbg_set_277a63e77c89279f(arg0, arg1, arg2) {
    const ret = arg0.set(arg1, arg2);
    return ret;
};

export function __wbg_isSafeInteger_b9dff570f01a9100(arg0) {
    const ret = Number.isSafeInteger(arg0);
    return ret;
};

export function __wbg_now_70af4fe37a792251() {
    const ret = Date.now();
    return ret;
};

export function __wbg_entries_c02034de337d3ee2(arg0) {
    const ret = Object.entries(arg0);
    return ret;
};

export function __wbg_new_1073970097e5a420(arg0, arg1) {
    try {
        var state0 = {a: arg0, b: arg1};
        var cb0 = (arg0, arg1) => {
            const a = state0.a;
            state0.a = 0;
            try {
                return __wbg_adapter_205(a, state0.b, arg0, arg1);
            } finally {
                state0.a = a;
            }
        };
        const ret = new Promise(cb0);
        return ret;
    } finally {
        state0.a = state0.b = 0;
    }
};

export function __wbg_resolve_0aad7c1484731c99(arg0) {
    const ret = Promise.resolve(arg0);
    return ret;
};

export function __wbg_then_748f75edfb032440(arg0, arg1) {
    const ret = arg0.then(arg1);
    return ret;
};

export function __wbg_then_4866a7d9f55d8f3e(arg0, arg1, arg2) {
    const ret = arg0.then(arg1, arg2);
    return ret;
};

export function __wbg_buffer_ccaed51a635d8a2d(arg0) {
    const ret = arg0.buffer;
    return ret;
};

export function __wbg_newwithbyteoffsetandlength_7e3eb787208af730(arg0, arg1, arg2) {
    const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
    return ret;
};

export function __wbg_new_fec2611eb9180f95(arg0) {
    const ret = new Uint8Array(arg0);
    return ret;
};

export function __wbg_set_ec2fcf81bc573fd9(arg0, arg1, arg2) {
    arg0.set(arg1, arg2 >>> 0);
};

export function __wbg_length_9254c4bd3b9f23c4(arg0) {
    const ret = arg0.length;
    return ret;
};

export function __wbg_instanceof_Uint8Array_df0761410414ef36(arg0) {
    let result;
    try {
        result = arg0 instanceof Uint8Array;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
};

export function __wbg_has_bd717f25f195f23d() { return handleError(function (arg0, arg1) {
    const ret = Reflect.has(arg0, arg1);
    return ret;
}, arguments) };

export function __wbg_stringify_eead5648c09faaf8() { return handleError(function (arg0) {
    const ret = JSON.stringify(arg0);
    return ret;
}, arguments) };

export function __wbindgen_bigint_get_as_i64(arg0, arg1) {
    const v = arg1;
    const ret = typeof(v) === 'bigint' ? v : undefined;
    getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
};

export function __wbindgen_debug_string(arg0, arg1) {
    const ret = debugString(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

export function __wbindgen_throw(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
};

export function __wbindgen_memory() {
    const ret = wasm.memory;
    return ret;
};

export function __wbindgen_closure_wrapper2884(arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 754, __wbg_adapter_52);
    return ret;
};

export function __wbindgen_closure_wrapper2911(arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 766, __wbg_adapter_55);
    return ret;
};

export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_export_2;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
    ;
};

