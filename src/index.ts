/**
 * KaitaiStream is an implementation of Kaitai Struct API for JavaScript.
 * Based on DataStream - https://github.com/kig/DataStream.js
 *
 * @param {ArrayBuffer} arrayBuffer ArrayBuffer to read from.
 * @param {?Number} byteOffset Offset from arrayBuffer beginning for the KaitaiStream.
 */
import {
  EOFError,
  UnexpectedDataError,
  UndecidedEndiannessError,
  ValidationNotEqualError,
  ValidationLessThanError,
  ValidationGreaterThanError,
  ValidationNotAnyOfError,
  ValidationExprError,
} from './error';

export class KaitaiStream {
  private pos: number;
  private _buffer!: ArrayBuffer;
  private _dataView!: DataView;

  /**
   * Virtual byte length of the KaitaiStream backing buffer.
   * Updated to be max of original buffer size and last written size.
   * If dynamicSize is false is set to buffer size.
   */
  private _byteLength: number = 0;
  private _byteOffset!: number;
  private bitsLeft!: number;
  private bits!: number;

  constructor(arrayBuffer: ArrayBuffer | DataView | number, byteOffset?: number) {
    this._byteOffset = byteOffset || 0;
    if (arrayBuffer instanceof ArrayBuffer) {
      this.buffer = arrayBuffer;
    } else if (typeof arrayBuffer == 'object') {
      this.dataView = arrayBuffer;
      if (byteOffset) {
        this._byteOffset += byteOffset;
      }
    } else {
      this.buffer = new ArrayBuffer(arrayBuffer || 1);
    }
    this.pos = 0;
    this.alignToByte();
  }

  /**
   * Set/get the backing ArrayBuffer of the KaitaiStream object.
   * The setter updates the DataView to point to the new buffer.
   */
  get buffer(): ArrayBuffer {
    this._trimAlloc();
    return this._buffer;
  }

  set buffer(v: ArrayBuffer) {
    this._buffer = v;
    this._dataView = new DataView(this._buffer, this._byteOffset);
    this._byteLength = this._buffer.byteLength;
  }

  /**
   * Set/get the byteOffset of the KaitaiStream object.
   * The setter updates the DataView to point to the new byteOffset.
   */
  get byteOffset(): number {
    return this._byteOffset;
  }

  set byteOffset(v) {
    this._byteOffset = v;
    this._dataView = new DataView(this._buffer, this._byteOffset);
    this._byteLength = this._buffer.byteLength;
  }

  /**
   * Set/get the backing DataView of the KaitaiStream object.
   * The setter updates the buffer and byteOffset to point to the DataView values.
   */
  get dataView() {
    return this._dataView;
  }

  set dataView({ byteOffset, buffer, byteLength }: DataView) {
    this._byteOffset = byteOffset;
    this._buffer = buffer;
    this._dataView = new DataView(this._buffer, this._byteOffset);
    this._byteLength = this._byteOffset + byteLength;
  }

  /**
   * Internal function to trim the KaitaiStream buffer when required.
   * Used for stripping out the extra bytes from the backing buffer when
   * the virtual byteLength is smaller than the buffer byteLength (happens after
   * growing the buffer with writes and not filling the extra space completely).
   *
   * @return {null}
   */
  public _trimAlloc() {
    if (this._byteLength === this._buffer.byteLength) {
      return;
    }
    const buf = new ArrayBuffer(this._byteLength);
    const dst = new Uint8Array(buf);
    const src = new Uint8Array(this._buffer, 0, dst.length);
    dst.set(src);
    this.buffer = buf;
  }

  // ========================================================================
  // Stream positioning
  // ========================================================================

  /**
   * Returns true if the KaitaiStream seek pointer is at the end of buffer and
   * there's no more data to read.
   *
   * @return {boolean} True if the seek pointer is at the end of the buffer.
   */
  public isEof() {
    return this.pos >= this.size && this.bitsLeft === 0;
  }

  /**
   * Sets the KaitaiStream read/write position to given position.
   * Clamps between 0 and KaitaiStream length.
   *
   * @param {number} pos Position to seek to.
   * @return {null}
   */
  public seek(pos: number) {
    const npos = Math.max(0, Math.min(this.size, pos));
    this.pos = (isNaN(npos) || !isFinite(npos)) ? 0 : npos;
  }

  /**
   * Returns the byte length of the KaitaiStream object.
   * @type {number}
   */
  get size() {
    return this._byteLength - this._byteOffset;
  }

  // ========================================================================
  // Integer numbers
  // ========================================================================

  // ------------------------------------------------------------------------
  // Signed
  // ------------------------------------------------------------------------

  /**
   * Reads an 8-bit signed int from the stream.
   * @return {number} The read number.
   */
  public readS1() {
    this.ensureBytesLeft(1);
    const v = this._dataView.getInt8(this.pos);
    this.pos += 1;
    return v;
  }

  // ........................................................................
  // Big-endian
  // ........................................................................

  /**
   * Reads a 16-bit big-endian signed int from the stream.
   * @return {number} The read number.
   */
  public readS2be() {
    this.ensureBytesLeft(2);
    const v = this._dataView.getInt16(this.pos);
    this.pos += 2;
    return v;
  }

  /**
   * Reads a 32-bit big-endian signed int from the stream.
   * @return {number} The read number.
   */
  public readS4be() {
    this.ensureBytesLeft(4);
    const v = this._dataView.getInt32(this.pos);
    this.pos += 4;
    return v;
  }

  /**
   * Reads a 64-bit big-endian unsigned int from the stream. Note that
   * JavaScript does not support 64-bit integers natively, so it will
   * automatically upgrade internal representation to use IEEE 754
   * double precision float.
   * @return {number} The read number.
   */
  public readS8be() {
    this.ensureBytesLeft(8);
    const v1 = this.readU4be();
    const v2 = this.readU4be();

    if ((v1 & 0x80000000) !== 0) {
      // negative number
      return -(0x100000000 * (v1 ^ 0xffffffff) + (v2 ^ 0xffffffff)) - 1;
    } else {
      return 0x100000000 * v1 + v2;
    }
  }

  // ........................................................................
  // Little-endian
  // ........................................................................

  /**
   * Reads a 16-bit little-endian signed int from the stream.
   * @return {number} The read number.
   */
  public readS2le() {
    this.ensureBytesLeft(2);
    const v = this._dataView.getInt16(this.pos, true);
    this.pos += 2;
    return v;
  }

  /**
   * Reads a 32-bit little-endian signed int from the stream.
   * @return {number} The read number.
   */
  public readS4le() {
    this.ensureBytesLeft(4);
    const v = this._dataView.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }

  /**
   * Reads a 64-bit little-endian unsigned int from the stream. Note that
   * JavaScript does not support 64-bit integers natively, so it will
   * automatically upgrade internal representation to use IEEE 754
   * double precision float.
   * @return {number} The read number.
   */
  public readS8le() {
    this.ensureBytesLeft(8);
    const v1 = this.readU4le();
    const v2 = this.readU4le();

    if ((v2 & 0x80000000) !== 0) {
      // negative number
      return -(0x100000000 * (v2 ^ 0xffffffff) + (v1 ^ 0xffffffff)) - 1;
    } else {
      return 0x100000000 * v2 + v1;
    }
  }

  // ------------------------------------------------------------------------
  // Unsigned
  // ------------------------------------------------------------------------

  /**
   * Reads an 8-bit unsigned int from the stream.
   * @return {number} The read number.
   */
  public readU1() {
    this.ensureBytesLeft(1);
    const v = this._dataView.getUint8(this.pos);
    this.pos += 1;
    return v;
  }

  // ........................................................................
  // Big-endian
  // ........................................................................

  /**
   * Reads a 16-bit big-endian unsigned int from the stream.
   * @return {number} The read number.
   */
  public readU2be() {
    this.ensureBytesLeft(2);
    const v = this._dataView.getUint16(this.pos);
    this.pos += 2;
    return v;
  }

  /**
   * Reads a 32-bit big-endian unsigned int from the stream.
   * @return {number} The read number.
   */
  public readU4be() {
    this.ensureBytesLeft(4);
    const v = this._dataView.getUint32(this.pos);
    this.pos += 4;
    return v;
  }

  /**
   * Reads a 64-bit big-endian unsigned int from the stream. Note that
   * JavaScript does not support 64-bit integers natively, so it will
   * automatically upgrade internal representation to use IEEE 754
   * double precision float.
   * @return {number} The read number.
   */
  public readU8be() {
    this.ensureBytesLeft(8);
    const v1 = this.readU4be();
    const v2 = this.readU4be();
    return 0x100000000 * v1 + v2;
  }

  // ........................................................................
  // Little-endian
  // ........................................................................

  /**
   * Reads a 16-bit little-endian unsigned int from the stream.
   * @return {number} The read number.
   */
  public readU2le() {
    this.ensureBytesLeft(2);
    const v = this._dataView.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }

  /**
   * Reads a 32-bit little-endian unsigned int from the stream.
   * @return {number} The read number.
   */
  public readU4le() {
    // this.ensureBytesLeft(4);
    const v = this._dataView.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }

  /**
   * Reads a 64-bit little-endian unsigned int from the stream. Note that
   * JavaScript does not support 64-bit integers natively, so it will
   * automatically upgrade internal representation to use IEEE 754
   * double precision float.
   * @return {number} The read number.
   */
  public readU8le() {
    this.ensureBytesLeft(8);
    const v1 = this.readU4le();
    const v2 = this.readU4le();
    return 0x100000000 * v2 + v1;
  }

  // ========================================================================
  // Floating point numbers
  // ========================================================================

  // ------------------------------------------------------------------------
  // Big endian
  // ------------------------------------------------------------------------

  public readF4be() {
    this.ensureBytesLeft(4);
    const v = this._dataView.getFloat32(this.pos);
    this.pos += 4;
    return v;
  }

  public readF8be() {
    this.ensureBytesLeft(8);
    const v = this._dataView.getFloat64(this.pos);
    this.pos += 8;
    return v;
  }

  // ------------------------------------------------------------------------
  // Little endian
  // ------------------------------------------------------------------------

  public readF4le() {
    this.ensureBytesLeft(4);
    const v = this._dataView.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  public readF8le() {
    this.ensureBytesLeft(8);
    const v = this._dataView.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  // ------------------------------------------------------------------------
  // Unaligned bit values
  // ------------------------------------------------------------------------

  public alignToByte() {
    this.bitsLeft = 0;
    this.bits = 0;
  }

  /*
    bitsLeft = 3
        \  \  bitsNeeded = 10 -> bytesNeeded = 2
          \  \ /         \
    |01101xxx|xxxxxxxx|xx......|
          \             /\     \
            \__ n = 13 _/  \     \
                          new bitsLeft = 6
    */
  public readBitsIntBe(n: number) {
    // JS only supports bit operations on 32 bits
    if (n > 32) {
      throw new RangeError(`readBitsIntBe: the maximum supported bit length is 32 (tried to read ${n} bits)`);
    }
    let res = 0;

    const bitsNeeded = n - this.bitsLeft;
    this.bitsLeft = -bitsNeeded & 7; // `-bitsNeeded mod 8`

    if (bitsNeeded > 0) {
      // 1 bit  => 1 byte
      // 8 bits => 1 byte
      // 9 bits => 2 bytes
      const bytesNeeded = ((bitsNeeded - 1) >> 3) + 1; // `ceil(bitsNeeded / 8)` (NB: `x >> 3` is `floor(x / 8)`)
      const buf = this.readBytes(bytesNeeded);
      for (let i = 0; i < bytesNeeded; i++) {
        res = res << 8 | buf[ i ];
      }

      const newBits = res;
      res = res >>> this.bitsLeft | this.bits << bitsNeeded; // `x << 32` is defined as `x << 0` in JS, but only `0 << 32`
      // can occur here (`n = 32` and `bitsLeft = 0`, this implies
      // `bits = 0` unless changed externally)
      this.bits = newBits; // will be masked at the end of the function
    } else {
      res = this.bits >>> -bitsNeeded; // shift unneeded bits out
    }

    const mask = (1 << this.bitsLeft) - 1; // `bitsLeft` is in range 0..7, so `(1 << 32)` does not have to be considered
    this.bits &= mask;

    // always return an unsigned 32-bit integer
    return res >>> 0;
  }

  /*
      n = 13       bitsNeeded = 10
                      /       \
    bitsLeft = 3  ______       __
      \  \      /      \      \ \
      |xxx01101|xxxxxxxx|......xx|
                          \    /
                      new bitsLeft = 6

            bitsLeft = 7
                \      \
      |01101100|..xxxxx1|........|
                  \___/
                  n = 5
    */
  public readBitsIntLe(n: number) {
    // JS only supports bit operations on 32 bits
    if (n > 32) {
      throw new RangeError(`readBitsIntLe: the maximum supported bit length is 32 (tried to read ${n} bits)`);
    }
    let res = 0;
    const bitsNeeded = n - this.bitsLeft;

    if (bitsNeeded > 0) {
      // 1 bit  => 1 byte
      // 8 bits => 1 byte
      // 9 bits => 2 bytes
      const bytesNeeded = ((bitsNeeded - 1) >> 3) + 1; // `ceil(bitsNeeded / 8)` (NB: `x >> 3` is `floor(x / 8)`)
      const buf = this.readBytes(bytesNeeded);
      for (let i = 0; i < bytesNeeded; i++) {
        res |= buf[ i ] << (i * 8);
      }

      // NB: in JavaScript, bit shift operators always shift by modulo 32 of the right-hand operand (see
      // https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-unsignedRightShift),
      // so `res >>> 32` is equivalent to `res >>> 0` (but we don't want that)
      const newBits = bitsNeeded < 32 ? res >>> bitsNeeded : 0;
      res = res << this.bitsLeft | this.bits;
      this.bits = newBits;
    } else {
      res = this.bits;
      this.bits >>>= n;
    }

    this.bitsLeft = -bitsNeeded & 7; // `-bitsNeeded mod 8`

    // always return an unsigned 32-bit integer
    if (n < 32) {
      const mask = (1 << n) - 1;
      res &= mask; // this produces a signed 32-bit int, but the sign bit is cleared
    } else {
      res >>>= 0;
    }
    return res;
  }

  // ========================================================================
  // Byte arrays
  // ========================================================================

  public readBytes(len: number) {
    return this.mapUint8Array(len);
  }

  public readBytesFull() {
    return this.mapUint8Array(this.size - this.pos);
  }

  public readBytesTerm(terminator: number, include: boolean, consume: boolean, eosError: EndOfStreamError) {
    let i;
    const blen = this.size - this.pos;
    const u8 = new Uint8Array(this._buffer, this._byteOffset + this.pos);
    for (i = 0; i < blen && u8[ i ] !== terminator; i++) {
      ;
    } // find first zero byte
    if (i === blen) {
      // we've read all the buffer and haven't found the terminator
      if (eosError) {
        throw `End of stream reached, but no terminator ${terminator} found`;
      } else {
        return this.mapUint8Array(i);
      }
    } else {
      let arr;
      if (include) {
        arr = this.mapUint8Array(i + 1);
      } else {
        arr = this.mapUint8Array(i);
      }
      if (consume) {
        this.pos += 1;
      }
      return arr;
    }
  }

  // Unused since Kaitai Struct Compiler v0.9+ - compatibility with older versions
  public ensureFixedContents(expected: Uint8Array) {
    const actual = this.readBytes(expected.length);
    if (actual.length !== expected.length) {
      throw new UnexpectedDataError(expected, actual);
    }
    const actLen = actual.length;
    for (let i = 0; i < actLen; i++) {
      if (actual[ i ] !== expected[ i ]) {
        throw new UnexpectedDataError(expected, actual);
      }
    }
    return actual;
  }

  /**
   * Ensures that we have a least `length` bytes left in the stream.
   * If that's not true, throws an EOFError.
   *
   * @param {number} length Number of bytes to require
   */
  public ensureBytesLeft(length: number) {
    if (this.pos + length > this.size) {
      throw new EOFError(length, this.size - this.pos);
    }
  }

  /**
   * Maps a Uint8Array into the KaitaiStream buffer.
   *
   * Nice for quickly reading in data.
   *
   * @param {number} length Number of elements to map.
   * @return {Object} Uint8Array to the KaitaiStream backing buffer.
   */
  public mapUint8Array(length: number) {
    length |= 0;

    this.ensureBytesLeft(length);

    const arr = new Uint8Array(this._buffer, this.byteOffset + this.pos, length);
    this.pos += length;
    return arr;
  }


  /**
   * Creates an array from an array of character codes.
   * Uses String.fromCharCode in chunks for memory efficiency and then concatenates
   * the resulting string chunks.
   *
   * @param {array|Uint8Array} array Array of character codes.
   * @return {string} String created from the character codes.
   */
  public static createStringFromArray(array: Uint8Array | number[]) {
    const chunk_size = 0x8000;
    const chunks: string[] = [];
    // @ts-ignore
    const subarray = array.subarray || array.slice;
    for (let i = 0; i < array.length; i += chunk_size) {
      chunks.push(String.fromCharCode.apply(null, subarray.call(array, i, i + chunk_size)));
    }
    return chunks.join('');
  };


  /**
   * Dependency configuration data. Holds urls for (optional) dynamic loading
   * of code dependencies from a remote server. For use by (static) processing functions.
   *
   * Caller should the supported keys to the asset urls as needed.
   * NOTE: `depUrls` is a static property of KaitaiStream (the factory),like the various
   * processing functions. It is NOT part of the prototype of instances.
   * @type {Object}
   */
  public static depUrls = {
    // processZlib uses this and expected a link to a copy of pako.
    // specifically the pako_inflate.min.js script at:
    // https://raw.githubusercontent.com/nodeca/pako/master/dist/pako_inflate.min.js
    zlib: undefined,
  };

  /**
   * Unused since Kaitai Struct Compiler v0.9+ - compatibility with older versions
   *
   * @deprecated use {@link readBitsIntBe} instead
   */
  public readBitsInt = KaitaiStream.prototype.readBitsIntBe;

  /**
   * Native endianness. Either KaitaiStream.BIG_ENDIAN or KaitaiStream.LITTLE_ENDIAN
   * depending on the platform endianness.
   *
   * @type {boolean}
   */
  public static endianness = new Int8Array(new Int16Array([ 1 ]).buffer)[ 0 ] > 0;

  public static bytesStripRight<T = number>(data: T[], padByte: T) {
    let newLen = data.length;
    while (data[ newLen - 1 ] === padByte) {
      newLen--;
    }
    return data.slice(0, newLen);
  };

  public static bytesTerminate<T = number>(data: T[], term: T, include: boolean) {
    let newLen = 0;
    const maxLen = data.length;
    while (newLen < maxLen && data[ newLen ] !== term) {
      newLen++;
    }
    if (include && newLen < maxLen)
      newLen++;
    return data.slice(0, newLen);
  };

  public static bytesToStr(arr: Uint8Array | number[], encoding: string) {
    if (encoding == null || encoding.toLowerCase() === 'ascii') {
      return KaitaiStream.createStringFromArray(arr);
    } else {
      if (typeof TextDecoder === 'function') {
        // we're in the browser that supports TextDecoder
        // @ts-ignore
        return (new TextDecoder(encoding)).decode(arr);
      } else {
        // probably we're in node.js

        // check if it's supported natively by node.js Buffer
        // see https://github.com/nodejs/node/blob/master/lib/buffer.js#L187 for details
        switch (encoding.toLowerCase()) {
          case 'utf8':
          case 'utf-8':
          case 'ucs2':
          case 'ucs-2':
          case 'utf16le':
          case 'utf-16le':
            // @ts-ignore
            return new Buffer(arr).toString(encoding);
          default:
            // unsupported encoding, we'll have to resort to iconv-lite
            if (typeof KaitaiStream.iconvlite === 'undefined') {
              KaitaiStream.iconvlite = require('iconv-lite');
            }

            return KaitaiStream.iconvlite.decode(arr, encoding);
        }
      }
    }
  }

  // ========================================================================
  // Byte array processing
  // ========================================================================

  public static processXorOne(data: number[], key: number) {
    const r = new Uint8Array(data.length);
    const dl = data.length;
    for (let i = 0; i < dl; i++)
      r[ i ] = data[ i ] ^ key;
    return r;
  }

  static processXorMany(data: number[], key: number[]) {
    const dl = data.length;
    const r = new Uint8Array(dl);
    const kl = key.length;
    let ki = 0;
    for (let i = 0; i < dl; i++) {
      r[ i ] = data[ i ] ^ key[ ki ];
      ki++;
      if (ki >= kl)
        ki = 0;
    }
    return r;
  }

  static processRotateLeft(data: number[], amount: number, groupSize: number) {
    if (groupSize !== 1) {
      throw(`unable to rotate group of ${groupSize} bytes yet`);
    }

    const mask = groupSize * 8 - 1;
    const antiAmount = -amount & mask;

    const r = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      r[ i ] = (data[ i ] << amount) & 0xff | (data[ i ] >> antiAmount);
    }

    return r;
  }

  private static zlib: any;

  public static processZlib(buf: Uint8Array) {
    // that commonjs
    if (typeof require !== 'undefined') {
      // require is available - we're running under node
      if (typeof KaitaiStream.zlib === 'undefined') {
        KaitaiStream.zlib = require('zlib');
      }
      // use node's zlib module API
      return KaitaiStream.zlib.inflateSync(
        Buffer.from(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
      );
    }
    //
    else {
      // no require() - assume we're running as a web worker in browser.
      // user should have configured KaitaiStream.depUrls.zlib, if not
      // we'll throw.
      if (typeof KaitaiStream.zlib === 'undefined'
        && typeof KaitaiStream.depUrls.zlib !== 'undefined') {
        importScripts(KaitaiStream.depUrls.zlib);
        KaitaiStream.zlib = pako;
      }
      // use pako API
      return KaitaiStream.zlib.inflate(buf);
    }
  };

  // ========================================================================
  // Misc runtime operations
  // ========================================================================
  public static mod(a: number, b: number) {
    if (b <= 0) {
      throw 'mod divisor <= 0';
    }
    let r = a % b;
    if (r < 0) {
      r += b;
    }
    return r;
  }

  public static arrayMin(arr: number[]) {
    let min = arr[ 0 ];
    let x;
    for (let i = 1, n = arr.length; i < n; ++i) {
      x = arr[ i ];
      if (x < min) {
        min = x;
      }
    }
    return min;
  }

  public static arrayMax(arr: number[]) {
    let max = arr[ 0 ];
    let x;
    for (let i = 1, n = arr.length; i < n; ++i) {
      x = arr[ i ];
      if (x > max) {
        max = x;
      }
    }
    return max;
  }

  public static byteArrayCompare(a: number[], b: number[]) {
    if (a === b) {
      return 0;
    }
    const al = a.length;
    const bl = b.length;
    const minLen = al < bl ? al : bl;
    for (let i = 0; i < minLen; i++) {
      const cmp = a[ i ] - b[ i ];
      if (cmp !== 0) {
        return cmp;
      }
    }

    // Reached the end of at least one of the arrays
    if (al === bl) {
      return 0;
    } else {
      return al - bl;
    }
  }

  public static EOFError = EOFError;
  public static UnexpectedDataError = UnexpectedDataError;
  public static UndecidedEndiannessError = UndecidedEndiannessError;
  public static ValidationNotEqualError = ValidationNotEqualError;
  public static ValidationLessThanError = ValidationLessThanError;
  public static ValidationGreaterThanError = ValidationGreaterThanError;
  public static ValidationNotAnyOfError = ValidationNotAnyOfError;
  public static ValidationExprError = ValidationExprError;
}
