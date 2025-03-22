import { initView, type ArrayBufferViewConstructor } from '../buffer.js';
import type { Mutable } from '../objects.js';
import { capitalize } from '../string.js';
import type { UnionToTuple } from '../types.js';

/** A definition for a primitive type */
export interface Type<T = any> {
	readonly name: string;
	readonly size: number;
	readonly array: ArrayBufferViewConstructor;
	get(this: void, view: DataView, offset: number, littleEndian: boolean): T;
	set(this: void, view: DataView, offset: number, littleEndian: boolean, value: T): void;
}

export function isType<T = any>(type: unknown): type is Type<T> {
	return (
		typeof type == 'object'
		&& type != null
		&& 'size' in type
		&& 'get' in type
		&& 'set' in type
		&& typeof type.size == 'number'
		&& typeof type.get == 'function'
		&& typeof type.set == 'function'
	);
}

const mask64 = BigInt('0xffffffffffffffff');

export function PrimitiveArray<T extends Type>(type: T) {
	return class PrimitiveArray<TArrayBuffer extends ArrayBufferLike = ArrayBuffer> extends Array {
		declare public readonly buffer: TArrayBuffer;
		declare public readonly byteOffset: number;
		declare public readonly byteLength: number;

		public constructor(
			buffer?: TArrayBuffer | ArrayBufferView<TArrayBuffer> | ArrayLike<number> | number,
			byteOffset?: number,
			byteLength?: number
		) {
			const length = typeof buffer == 'number' ? buffer : (byteLength ?? type.size) / type.size;

			if (!Number.isSafeInteger(length)) throw new Error('Invalid array length: ' + length);

			super(length);

			if (typeof buffer != 'number') initView(this, buffer, byteOffset, byteLength);
			else {
				this.buffer = new ArrayBuffer(buffer * type.size) as TArrayBuffer;
				this.byteOffset = 0;
				this.byteLength = buffer * type.size;
			}

			const view = new DataView(this.buffer, this.byteOffset, this.byteLength);

			for (let i = 0; i < length; i++) {
				this[i] = type.get(view, i * type.size, false);
			}
		}
	};
}

export const types = {
	int8: {
		name: 'int8',
		size: 1,
		array: Int8Array,
		get: (view, offset) => view.getInt8(offset),
		set: (view, offset, _le, value) => view.setInt8(offset, value),
	},

	uint8: {
		name: 'uint8',
		size: 1,
		array: Uint8Array,
		get: (view, offset) => view.getUint8(offset),
		set: (view, offset, _le, value) => view.setUint8(offset, value),
	},

	int16: {
		name: 'int16',
		size: 2,
		array: Int16Array,
		get: (view, offset, le) => view.getInt16(offset, le),
		set: (view, offset, le, value) => view.setInt16(offset, value, le),
	},

	uint16: {
		name: 'uint16',
		size: 2,
		array: Uint16Array,
		get: (view, offset, le) => view.getUint16(offset, le),
		set: (view, offset, le, value) => view.setUint16(offset, value, le),
	},

	int32: {
		name: 'int32',
		size: 4,
		array: Int32Array,
		get: (view, offset, le) => view.getInt32(offset, le),
		set: (view, offset, le, value) => view.setInt32(offset, value, le),
	},

	uint32: {
		name: 'uint32',
		size: 4,
		array: Uint32Array,
		get: (view, offset, le) => view.getUint32(offset, le),
		set: (view, offset, le, value) => view.setUint32(offset, value, le),
	},

	int64: {
		name: 'int64',
		size: 8,
		array: BigInt64Array,
		get: (view, offset, le) => view.getBigInt64(offset, le),
		set: (view, offset, le, value) => view.setBigInt64(offset, value, le),
	},

	uint64: {
		name: 'uint64',
		size: 8,
		array: BigUint64Array,
		get: (view, offset, le) => view.getBigUint64(offset, le),
		set: (view, offset, le, value) => view.setBigUint64(offset, value, le),
	},

	int128: {
		name: 'int128',
		size: 16,
		array: {} as ArrayBufferViewConstructor,
		get: (view, offset, le) =>
			(view.getBigInt64(offset + (le ? 8 : 0), le) << BigInt(64)) | view.getBigUint64(offset + (le ? 0 : 8), le),
		set: (view, offset, le, value) => {
			view.setBigUint64(offset + (le ? 0 : 8), BigInt(value) & mask64, le);
			view.setBigInt64(offset + (le ? 8 : 0), BigInt(value) >> BigInt(64), le);
		},
	},

	uint128: {
		name: 'uint128',
		size: 16,
		array: {} as ArrayBufferViewConstructor,
		get: (view, offset, le) =>
			(view.getBigUint64(offset + (le ? 8 : 0), le) << BigInt(64)) | view.getBigUint64(offset + (le ? 0 : 8), le),
		set: (view, offset, le, value) => {
			view.setBigUint64(offset + (le ? 0 : 8), BigInt(value) & mask64, le);
			view.setBigUint64(offset + (le ? 8 : 0), BigInt(value) >> BigInt(64), le);
		},
	},

	float32: {
		name: 'float32',
		size: 4,
		array: Float32Array,
		get: (view, offset, le) => view.getFloat32(offset, le),
		set: (view, offset, le, value) => view.setFloat32(offset, value, le),
	},

	float64: {
		name: 'float64',
		size: 8,
		array: Float64Array,
		get: (view, offset, le) => view.getFloat64(offset, le),
		set: (view, offset, le, value) => view.setFloat64(offset, value, le),
	},

	float128: {
		name: 'float128',
		size: 16,
		array: {} as ArrayBufferViewConstructor,
		get: (view, offset, le) => view.getFloat64(offset + (le ? 0 : 8), le),
		set: (view, offset, le, value) => {
			view.setFloat64(offset + (le ? 0 : 8), value, le);
			view.setBigUint64(offset + (le ? 8 : 0), BigInt(0), le);
		},
	},
} as const satisfies Record<string, Type>;

(types.int128 as Mutable<typeof types.int128>).array = class Int128Array extends PrimitiveArray(types.int128) {};
(types.uint128 as Mutable<typeof types.uint128>).array = class Uint128Array extends PrimitiveArray(types.uint128) {};
(types.float128 as Mutable<typeof types.float128>).array = class Float128Array extends (
	PrimitiveArray(types.float128)
) {};

export type TypeName = keyof typeof types;

export const typeNames = Object.keys(types) as UnionToTuple<TypeName>;

export function isTypeName(type: { toString(): string }): type is TypeName {
	return typeNames.includes(type.toString() as TypeName);
}

export type Valid = TypeName | Capitalize<TypeName> | 'char';

export const validNames = [...typeNames, ...typeNames.map(t => capitalize(t)), 'char'] satisfies Valid[];

export function isValid(type: { toString(): string }): type is Valid {
	return validNames.includes(type.toString() as Valid);
}

export function checkValid(type: { toString(): string }): asserts type is Valid {
	if (!isValid(type)) throw new TypeError('Not a valid primitive type: ' + type);
}

export type Normalize<T extends Valid> = (T extends 'char' ? 'uint8' : Uncapitalize<T>) & TypeName;

export function normalize<T extends Valid>(type: T): Normalize<T> {
	return (type == 'char' ? 'uint8' : type.toLowerCase()) as Normalize<T>;
}

export type Size<T extends Valid | Type> = (T extends Valid ? (typeof types)[Normalize<T>] : T)['size'];
