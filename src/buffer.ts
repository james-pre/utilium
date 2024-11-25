import type { Buffer as NodeBuffer } from 'buffer';

export class Buffer extends Uint8Array implements NodeBuffer {
	protected view = new DataView(this.buffer, this.byteOffset, this.byteLength);

	constructor(input: string | ArrayBufferLike | Uint8Array | number | readonly any[], encoding?: BufferEncoding) {
		if (typeof input === 'number') {
			super(input);
		} else if (typeof input === 'string') {
			super(encode(input, encoding || 'utf8'));
		} else {
			super(input);
		}
		this.view = new DataView(this.buffer, this.byteOffset, this.byteLength);
	}

	fill(value: string | Uint8Array | number, offset: number = 0, end: number = this.length, encoding: BufferEncoding = 'utf8'): this {
		const fillValue: Uint8Array = typeof value === 'string' ? encode(value, encoding) : typeof value === 'number' ? new Uint8Array([value & 0xff]) : value;

		for (let i = offset; i < end; i++) {
			this[i] = fillValue[i % fillValue.length];
		}
		return this;
	}

	indexOf(value: string | number | Uint8Array, byteOffset: number = 0, encoding: BufferEncoding = 'utf8'): number {
		const searchValue: Uint8Array = typeof value === 'string' ? encode(value, encoding) : typeof value === 'number' ? new Uint8Array([value & 0xff]) : value;

		for (let i = byteOffset; i <= this.length - searchValue.length; i++) {
			let match = true;
			for (let j = 0; j < searchValue.length; j++) {
				if (this[i + j] !== searchValue[j]) {
					match = false;
					break;
				}
			}
			if (match) return i;
		}
		return -1;
	}

	lastIndexOf(value: string | number | Uint8Array, byteOffset: number = this.length - 1, encoding: BufferEncoding = 'utf8'): number {
		const searchValue: Uint8Array = typeof value === 'string' ? encode(value, encoding) : typeof value === 'number' ? new Uint8Array([value & 0xff]) : value;

		for (let i = Math.min(byteOffset, this.length - searchValue.length); i >= 0; i--) {
			let match = true;
			for (let j = 0; j < searchValue.length; j++) {
				if (this[i + j] !== searchValue[j]) {
					match = false;
					break;
				}
			}
			if (match) return i;
		}
		return -1;
	}

	write(string: string, offset?: number | BufferEncoding, length?: number | BufferEncoding, encoding?: BufferEncoding): number {
		let actualOffset = 0;
		let actualLength = this.length;
		let actualEncoding: BufferEncoding = 'utf8';

		if (typeof offset === 'number') {
			actualOffset = offset;
		} else if (typeof offset === 'string') {
			actualEncoding = offset;
		}

		if (typeof length === 'number') {
			actualLength = length;
		} else if (typeof length === 'string') {
			actualEncoding = length;
		}

		if (encoding) {
			actualEncoding = encoding;
		}

		if (actualOffset < 0 || actualOffset >= this.length) {
			throw new RangeError('Offset is out of bounds');
		}

		const encodedString = encode(string, actualEncoding);
		const bytesToWrite = Math.min(actualLength, encodedString.length);

		for (let i = 0; i < bytesToWrite; i++) {
			if (actualOffset + i >= this.length) break;
			this[actualOffset + i] = encodedString[i];
		}

		return bytesToWrite;
	}

	toJSON(): { type: 'Buffer'; data: number[] } {
		return { type: 'Buffer', data: Array.from(this) };
	}

	toString(encoding: BufferEncoding = 'utf8', start: number = 0, end: number = this.length): string {
		return decode(this.slice(start, end), encoding);
	}

	equals(otherBuffer: Uint8Array): boolean {
		if (this.byteLength !== otherBuffer.byteLength) return false;
		for (let i = 0; i < this.byteLength; i++) {
			if (this[i] !== otherBuffer[i]) return false;
		}
		return true;
	}

	compare(target: Uint8Array, targetStart = 0, targetEnd = target.byteLength, sourceStart = 0, sourceEnd = this.byteLength): -1 | 0 | 1 {
		const sourceSlice = this.subarray(sourceStart, sourceEnd);
		const targetSlice = target.subarray(targetStart, targetEnd);

		for (let i = 0; i < Math.min(sourceSlice.length, targetSlice.length); i++) {
			if (sourceSlice[i] < targetSlice[i]) return -1;
			if (sourceSlice[i] > targetSlice[i]) return 1;
		}

		if (sourceSlice.length < targetSlice.length) return -1;
		if (sourceSlice.length > targetSlice.length) return 1;
		return 0;
	}

	copy(target: Uint8Array, targetStart = 0, sourceStart = 0, sourceEnd = this.byteLength): number {
		const sourceSlice = this.subarray(sourceStart, sourceEnd);
		target.set(sourceSlice, targetStart);
		return sourceSlice.length;
	}

	// BigInt methods
	writeBigInt64BE(value: bigint, offset = 0): number {
		this.view.setBigInt64(offset, value, false);
		return offset + 8;
	}

	writeBigInt64LE(value: bigint, offset = 0): number {
		this.view.setBigInt64(offset, value, true);
		return offset + 8;
	}

	writeBigUint64BE(value: bigint, offset = 0): number {
		this.view.setBigUint64(offset, value, false);
		return offset + 8;
	}

	writeBigUInt64BE = this.writeBigUint64BE.bind(this);

	writeBigUint64LE(value: bigint, offset = 0): number {
		this.view.setBigUint64(offset, value, true);
		return offset + 8;
	}

	writeBigUInt64LE = this.writeBigUint64LE.bind(this);

	// Integer methods
	writeUintLE(value: number, offset: number, byteLength: number): number {
		for (let i = 0; i < byteLength; i++) {
			this[offset + i] = (value >> (8 * i)) & 0xff;
		}
		return offset + byteLength;
	}

	writeUIntLE = this.writeUintLE.bind(this);

	writeUintBE(value: number, offset: number, byteLength: number): number {
		for (let i = 0; i < byteLength; i++) {
			this[offset + byteLength - i - 1] = (value >> (8 * i)) & 0xff;
		}
		return offset + byteLength;
	}

	writeUIntBE = this.writeUintBE.bind(this);

	writeIntLE(value: number, offset: number, byteLength: number): number {
		let tempValue = value;
		for (let i = 0; i < byteLength; i++) {
			this[offset + i] = tempValue & 0xff;
			tempValue >>= 8;
		}
		return offset + byteLength;
	}

	writeIntBE(value: number, offset: number, byteLength: number): number {
		let tempValue = value;
		for (let i = byteLength - 1; i >= 0; i--) {
			this[offset + i] = tempValue & 0xff;
			tempValue >>= 8;
		}
		return offset + byteLength;
	}

	// Read methods
	readBigUint64BE(offset = 0): bigint {
		return this.view.getBigUint64(offset, false);
	}

	readBigUInt64BE = this.readBigUint64BE.bind(this);

	readBigUint64LE(offset = 0): bigint {
		return this.view.getBigUint64(offset, true);
	}

	readBigUInt64LE = this.readBigUint64LE.bind(this);

	readBigInt64BE(offset = 0): bigint {
		return this.view.getBigInt64(offset, false);
	}

	readBigInt64LE(offset = 0): bigint {
		return this.view.getBigInt64(offset, true);
	}

	readUintLE(offset: number, byteLength: number): number {
		let value = 0;
		for (let i = 0; i < byteLength; i++) {
			value |= this[offset + i] << (8 * i);
		}
		return value;
	}

	readUIntLE = this.readUintLE.bind(this);

	readUintBE(offset: number, byteLength: number): number {
		let value = 0;
		for (let i = 0; i < byteLength; i++) {
			value |= this[offset + byteLength - i - 1] << (8 * i);
		}
		return value;
	}

	readUIntBE = this.readUintBE.bind(this);

	readIntLE(offset: number, byteLength: number): number {
		let value = this.readUIntLE(offset, byteLength);
		const limit = 1 << (byteLength * 8 - 1);
		if (value >= limit) value -= limit * 2;
		return value;
	}

	readIntBE(offset: number, byteLength: number): number {
		let value = this.readUIntBE(offset, byteLength);
		const limit = 1 << (byteLength * 8 - 1);
		if (value >= limit) value -= limit * 2;
		return value;
	}

	readUint8(offset = 0): number {
		return this.view.getUint8(offset);
	}

	readUInt8 = this.readUint8.bind(this);

	readUint16LE(offset = 0): number {
		return this.view.getUint16(offset, true);
	}

	readUInt16LE = this.readUint16LE.bind(this);

	readUint16BE(offset = 0): number {
		return this.view.getUint16(offset, false);
	}

	readUInt16BE = this.readUint16BE.bind(this);

	readUint32LE(offset = 0): number {
		return this.view.getUint32(offset, true);
	}

	readUInt32LE = this.readUint32LE.bind(this);

	readUint32BE(offset = 0): number {
		return this.view.getUint32(offset, false);
	}

	readUInt32BE = this.readUint32BE.bind(this);

	readInt8(offset = 0): number {
		return this.view.getInt8(offset);
	}

	readInt16LE(offset = 0): number {
		return this.view.getInt16(offset, true);
	}

	readInt16BE(offset = 0): number {
		return this.view.getInt16(offset, false);
	}

	readInt32LE(offset = 0): number {
		return this.view.getInt32(offset, true);
	}

	readInt32BE(offset = 0): number {
		return this.view.getInt32(offset, false);
	}

	readFloatLE(offset = 0): number {
		return this.view.getFloat32(offset, true);
	}

	readFloatBE(offset = 0): number {
		return this.view.getFloat32(offset, false);
	}

	readDoubleLE(offset = 0): number {
		return this.view.getFloat64(offset, true);
	}

	readDoubleBE(offset = 0): number {
		return this.view.getFloat64(offset, false);
	}

	slice(start?: number, end?: number): Buffer {
		return new Buffer(super.slice(start, end));
	}

	subarray(begin?: number, end?: number): Buffer {
		return new Buffer(super.subarray(begin, end));
	}

	reverse(): this {
		super.reverse();
		return this;
	}

	// Swap methods
	swap16(): Buffer {
		for (let i = 0; i < this.length; i += 2) {
			const a = this[i];
			this[i] = this[i + 1];
			this[i + 1] = a;
		}
		return this;
	}

	swap32(): Buffer {
		for (let i = 0; i < this.length; i += 4) {
			let a = this[i];
			let b = this[i + 1];
			this[i] = this[i + 3];
			this[i + 1] = this[i + 2];
			this[i + 2] = b;
			this[i + 3] = a;
		}
		return this;
	}

	swap64(): Buffer {
		for (let i = 0; i < this.length; i += 8) {
			let a = this[i];
			let b = this[i + 1];
			let c = this[i + 2];
			let d = this[i + 3];
			this[i] = this[i + 7];
			this[i + 1] = this[i + 6];
			this[i + 2] = this[i + 5];
			this[i + 3] = this[i + 4];
			this[i + 4] = d;
			this[i + 5] = c;
			this[i + 6] = b;
			this[i + 7] = a;
		}
		return this;
	}

	// Write methods
	writeUint8(value: number, offset = 0): number {
		this.view.setUint8(offset, value);
		return offset + 1;
	}

	writeUInt8 = this.writeUint8.bind(this);

	writeUint16LE(value: number, offset = 0): number {
		this.view.setUint16(offset, value, true);
		return offset + 2;
	}

	writeUInt16LE = this.writeUint16LE.bind(this);

	writeUint16BE(value: number, offset = 0): number {
		this.view.setUint16(offset, value, false);
		return offset + 2;
	}

	writeUInt16BE = this.writeUint16BE.bind(this);

	writeUint32LE(value: number, offset = 0): number {
		this.view.setUint32(offset, value, true);
		return offset + 4;
	}

	writeUInt32LE = this.writeUint32LE.bind(this);

	writeUint32BE(value: number, offset = 0): number {
		this.view.setUint32(offset, value, false);
		return offset + 4;
	}

	writeUInt32BE = this.writeUint32BE.bind(this);

	writeInt8(value: number, offset = 0): number {
		this.view.setInt8(offset, value);
		return offset + 1;
	}

	writeInt16LE(value: number, offset = 0): number {
		this.view.setInt16(offset, value, true);
		return offset + 2;
	}

	writeInt16BE(value: number, offset = 0): number {
		this.view.setInt16(offset, value, false);
		return offset + 2;
	}

	writeInt32LE(value: number, offset = 0): number {
		this.view.setInt32(offset, value, true);
		return offset + 4;
	}

	writeInt32BE(value: number, offset = 0): number {
		this.view.setInt32(offset, value, false);
		return offset + 4;
	}

	writeFloatLE(value: number, offset = 0): number {
		this.view.setFloat32(offset, value, true);
		return offset + 4;
	}

	writeFloatBE(value: number, offset = 0): number {
		this.view.setFloat32(offset, value, false);
		return offset + 4;
	}

	writeDoubleLE(value: number, offset = 0): number {
		this.view.setFloat64(offset, value, true);
		return offset + 8;
	}

	writeDoubleBE(value: number, offset = 0): number {
		this.view.setFloat64(offset, value, false);
		return offset + 8;
	}

	static from(
		value:
			| WithImplicitCoercion<ArrayBufferLike | Uint8Array | string | readonly number[]>
			| { [Symbol.toPrimitive](hint: 'string'): string }
			| ArrayLike<number>
			| Iterable<number>,
		encodingOrOffset?: number | BufferEncoding | ((v: any, k: number) => number),
		length?: number
	): Buffer {
		if (typeof value === 'string' || (typeof value === 'object' && Symbol.toPrimitive in value)) {
			const str = typeof value === 'string' ? value : value[Symbol.toPrimitive]('string');
			return new Buffer(encode(str, typeof encodingOrOffset === 'string' ? encodingOrOffset : 'utf8'));
		}

		if (value instanceof ArrayBuffer || value instanceof SharedArrayBuffer) {
			const byteOffset = typeof encodingOrOffset === 'number' ? encodingOrOffset : 0;
			const byteLength = typeof length === 'number' ? length : value.byteLength - byteOffset;
			return new Buffer(new Uint8Array(value, byteOffset, byteLength));
		}

		if (Array.isArray(value) || value instanceof Uint8Array) {
			return new Buffer(new Uint8Array(value));
		}

		if (typeof value === 'object' && typeof encodingOrOffset === 'function') {
			const mappedArray = Array.from(value as ArrayLike<any>, encodingOrOffset, length);
			return new Buffer(new Uint8Array(mappedArray));
		}

		if (typeof value === 'object' && Symbol.iterator in value) {
			return new Buffer(new Uint8Array(Array.from(value as Iterable<number>)));
		}

		throw new TypeError('The "value" argument must be one of type string, Buffer, ArrayBuffer, or Array-like object.');
	}

	static alloc(size: number, fill?: string | number | Uint8Array, encoding: BufferEncoding = 'utf8'): Buffer {
		const buffer = new Buffer(size);
		if (fill === undefined) return buffer;

		if (typeof fill === 'string') {
			buffer.fill(encode(fill, encoding));
		} else if (typeof fill === 'number') {
			buffer.fill(fill);
		} else {
			buffer.set(fill);
		}

		return buffer;
	}

	static allocUnsafe(size: number): Buffer {
		return new Buffer(size);
	}

	static allocUnsafeSlow(size: number): Buffer {
		return new Buffer(size);
	}

	static concat(list: readonly Uint8Array[], totalLength?: number): Buffer {
		if (list.length === 0) return Buffer.alloc(0);

		totalLength ??= list.reduce((acc, buf) => acc + buf.length, 0);

		const buffer = Buffer.allocUnsafe(totalLength);
		let offset = 0;
		for (const buf of list) {
			buffer.set(buf, offset);
			offset += buf.length;
		}
		return buffer;
	}

	static isBuffer(obj: any): obj is Buffer {
		return obj instanceof Buffer;
	}

	static byteLength(string: string | ArrayBufferLike | NodeJS.ArrayBufferView, encoding: BufferEncoding = 'utf8'): number {
		if (typeof string === 'string') {
			return encode(string, encoding).length;
		} else if (string instanceof ArrayBuffer || string instanceof SharedArrayBuffer || string instanceof Uint8Array) {
			return string.byteLength;
		} else {
			throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer.');
		}
	}

	static isEncoding(encoding: string): encoding is BufferEncoding {
		return ['utf8', 'utf-8', 'ascii', 'latin1', 'binary', 'base64', 'base64url', 'hex', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le'].includes(encoding.toLowerCase());
	}

	static compare(buf1: Uint8Array, buf2: Uint8Array): -1 | 0 | 1 {
		if (!(buf1 instanceof Uint8Array) || !(buf2 instanceof Uint8Array)) {
			throw new TypeError('Arguments must be Buffers');
		}
		if (buf1 === buf2) return 0;

		for (let i = 0; i < Math.min(buf1.length, buf2.length); i++) {
			if (buf1[i] !== buf2[i]) {
				return buf1[i] < buf2[i] ? -1 : 1;
			}
		}
		if (buf1.length < buf2.length) return -1;
		if (buf1.length > buf2.length) return 1;
		return 0;
	}

	static of(...items: number[]): Buffer {
		return new Buffer(items);
	}

	static copyBytesFrom(view: NodeJS.TypedArray, offset: number = 0, length?: number): Buffer {
		const actualLength = length !== undefined ? length : view.length - offset;
		return new Buffer(view.buffer.slice(view.byteOffset + offset, actualLength));
	}

	static poolSize: number = 8192;
}

Buffer satisfies typeof NodeBuffer;

function decode(data: Uint8Array, encoding: BufferEncoding) {
	switch (encoding) {
		case 'base64':
			return btoa(String.fromCharCode(...data));
		case 'base64url':
			return btoa(String.fromCharCode(...data))
				.replace(/\+/g, '-')
				.replace(/\//g, '_')
				.replace(/=+$/, '');
		case 'binary':
			return String.fromCharCode(...data);
		case 'hex':
			return Array.from(data)
				.map(byte => byte.toString(16).padStart(2, '0'))
				.join('');
		case 'utf16le':
		case 'ucs2':
		case 'ucs-2':
			encoding = 'utf-16le';
		// Fall through to use TextDecoder
		default:
			return new TextDecoder(encoding).decode(data);
	}
}

function encode(input: string, encoding: BufferEncoding): Uint8Array {
	switch (encoding) {
		case 'utf-16le':
		case 'utf16le':
		case 'ucs2':
		case 'ucs-2': {
			const buffer = new Uint8Array(input.length * 2);
			for (let i = 0; i < input.length; i++) {
				const code = input.charCodeAt(i);
				buffer[i * 2] = code & 0xff;
				buffer[i * 2 + 1] = code >> 8;
			}
			return buffer;
		}
		case 'base64': {
			const binaryString = atob(input);
			const buffer = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				buffer[i] = binaryString.charCodeAt(i);
			}
			return buffer;
		}
		case 'base64url': {
			input = input.replace(/-/g, '+').replace(/_/g, '/');
			while (input.length % 4 !== 0) {
				input += '=';
			}
			const binaryString = atob(input);
			const buffer = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				buffer[i] = binaryString.charCodeAt(i);
			}
			return buffer;
		}
		case 'binary': {
			const buffer = new Uint8Array(input.length);
			for (let i = 0; i < input.length; i++) {
				buffer[i] = input.charCodeAt(i);
			}
			return buffer;
		}
		case 'hex': {
			const buffer = new Uint8Array(input.length / 2);
			for (let i = 0; i < buffer.length; i++) {
				buffer[i] = parseInt(input.substring(i * 2, 2), 16);
			}
			return buffer;
		}
		case 'ascii':
		case 'utf8':
		case 'utf-8':
		case 'latin1':
			return new TextEncoder().encode(input);
	}
}
