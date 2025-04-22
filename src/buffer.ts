/* eslint-disable @typescript-eslint/no-unused-expressions */

import type { Mutable } from './objects.js';

/**
 * A generic constructor for an `ArrayBufferView`
 */
export interface ArrayBufferViewConstructor {
	readonly prototype: ArrayBufferView<ArrayBufferLike>;
	new (length: number): ArrayBufferView<ArrayBuffer>;
	new (array: ArrayLike<number>): ArrayBufferView<ArrayBuffer>;
	new <TArrayBuffer extends ArrayBufferLike = ArrayBuffer>(
		buffer: TArrayBuffer,
		byteOffset?: number,
		length?: number
	): ArrayBufferView<TArrayBuffer>;
	new (array: ArrayLike<number> | ArrayBuffer): ArrayBufferView<ArrayBuffer>;
}

/**
 * A generic typed array.
 * @see https://mdn.io/TypedArray
 */
export interface TypedArray<TArrayBuffer extends ArrayBufferLike = ArrayBuffer, TValue = number | bigint>
	extends ArrayBufferView<TArrayBuffer> {
	/**
	 * The size in bytes of each element in the array.
	 */
	readonly BYTES_PER_ELEMENT: number;

	/**
	 * Returns the this object after copying a section of the array identified by start and end
	 * to the same array starting at position target
	 * @param target If target is negative, it is treated as length+target where length is the
	 * length of the array.
	 * @param start If start is negative, it is treated as length+start. If end is negative, it
	 * is treated as length+end.
	 * @param end If not specified, length of the this object is used as its default value.
	 */
	copyWithin(target: number, start: number, end?: number): this;

	/**
	 * Determines whether all the members of an array satisfy the specified test.
	 * @param predicate A function that accepts up to three arguments. The every method calls
	 * the predicate function for each element in the array until the predicate returns a value
	 * which is coercible to the Boolean value false, or until the end of the array.
	 * @param thisArg An object to which the this keyword can refer in the predicate function.
	 * If thisArg is omitted, undefined is used as the this value.
	 */
	every(predicate: (value: TValue, index: number, array: this) => unknown, thisArg?: any): boolean;

	/**
	 * Changes all array elements from `start` to `end` index to a static `value` and returns the modified array
	 * @param value value to fill array section with
	 * @param start index to start filling the array at. If start is negative, it is treated as
	 * length+start where length is the length of the array.
	 * @param end index to stop filling the array at. If end is negative, it is treated as
	 * length+end.
	 */
	fill(value: TValue, start?: number, end?: number): this;

	/**
	 * Returns the elements of an array that meet the condition specified in a callback function.
	 * @param predicate A function that accepts up to three arguments. The filter method calls
	 * the predicate function one time for each element in the array.
	 * @param thisArg An object to which the this keyword can refer in the predicate function.
	 * If thisArg is omitted, undefined is used as the this value.
	 */
	filter(
		predicate: (value: TValue, index: number, array: this) => any,
		thisArg?: any
	): TypedArray<TArrayBuffer, TValue>;

	/**
	 * Returns the value of the first element in the array where predicate is true, and undefined
	 * otherwise.
	 * @param predicate find calls predicate once for each element of the array, in ascending
	 * order, until it finds one where predicate returns true. If such an element is found, find
	 * immediately returns that element value. Otherwise, find returns undefined.
	 * @param thisArg If provided, it will be used as the this value for each invocation of
	 * predicate. If it is not provided, undefined is used instead.
	 */
	find(predicate: (value: TValue, index: number, obj: this) => boolean, thisArg?: any): TValue | undefined;

	/**
	 * Returns the index of the first element in the array where predicate is true, and -1
	 * otherwise.
	 * @param predicate find calls predicate once for each element of the array, in ascending
	 * order, until it finds one where predicate returns true. If such an element is found,
	 * findIndex immediately returns that element index. Otherwise, findIndex returns -1.
	 * @param thisArg If provided, it will be used as the this value for each invocation of
	 * predicate. If it is not provided, undefined is used instead.
	 */
	findIndex(predicate: (value: TValue, index: number, obj: this) => boolean, thisArg?: any): number;

	/**
	 * Performs the specified action for each element in an array.
	 * @param callbackfn  A function that accepts up to three arguments. forEach calls the
	 * callbackfn function one time for each element in the array.
	 * @param thisArg  An object to which the this keyword can refer in the callbackfn function.
	 * If thisArg is omitted, undefined is used as the this value.
	 */
	forEach(callbackfn: (value: TValue, index: number, array: this) => void, thisArg?: any): void;

	/**
	 * Returns the index of the first occurrence of a value in an array.
	 * @param searchElement The value to locate in the array.
	 * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the
	 *  search starts at index 0.
	 */
	indexOf(searchElement: TValue, fromIndex?: number): number;

	/**
	 * Adds all the elements of an array separated by the specified separator string.
	 * @param separator A string used to separate one element of an array from the next in the
	 * resulting String. If omitted, the array elements are separated with a comma.
	 */
	join(separator?: string): string;

	/**
	 * Returns the index of the last occurrence of a value in an array.
	 * @param searchElement The value to locate in the array.
	 * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the
	 * search starts at index 0.
	 */
	lastIndexOf(searchElement: TValue, fromIndex?: number): number;

	/**
	 * The length of the array.
	 */
	readonly length: number;

	/**
	 * Calls a defined callback function on each element of an array, and returns an array that
	 * contains the results.
	 * @param callbackfn A function that accepts up to three arguments. The map method calls the
	 * callbackfn function one time for each element in the array.
	 * @param thisArg An object to which the this keyword can refer in the callbackfn function.
	 * If thisArg is omitted, undefined is used as the this value.
	 */
	map(
		callbackfn: (value: TValue, index: number, array: this) => TValue,
		thisArg?: any
	): TypedArray<TArrayBuffer, TValue>;

	/**
	 * Calls the specified callback function for all the elements in an array. The return value of
	 * the callback function is the accumulated result, and is provided as an argument in the next
	 * call to the callback function.
	 * @param callbackfn A function that accepts up to four arguments. The reduce method calls the
	 * callbackfn function one time for each element in the array.
	 * @param initialValue If initialValue is specified, it is used as the initial value to start
	 * the accumulation. The first call to the callbackfn function provides this value as an argument
	 * instead of an array value.
	 */
	reduce(
		callbackfn: (previousValue: TValue, currentValue: TValue, currentIndex: number, array: this) => number
	): number;
	reduce(
		callbackfn: (previousValue: TValue, currentValue: TValue, currentIndex: number, array: this) => number,
		initialValue: number
	): number;

	/**
	 * Calls the specified callback function for all the elements in an array. The return value of
	 * the callback function is the accumulated result, and is provided as an argument in the next
	 * call to the callback function.
	 * @param callbackfn A function that accepts up to four arguments. The reduce method calls the
	 * callbackfn function one time for each element in the array.
	 * @param initialValue If initialValue is specified, it is used as the initial value to start
	 * the accumulation. The first call to the callbackfn function provides this value as an argument
	 * instead of an array value.
	 */
	reduce<U>(
		callbackfn: (previousValue: U, currentValue: TValue, currentIndex: number, array: this) => U,
		initialValue: U
	): U;

	/**
	 * Calls the specified callback function for all the elements in an array, in descending order.
	 * The return value of the callback function is the accumulated result, and is provided as an
	 * argument in the next call to the callback function.
	 * @param callbackfn A function that accepts up to four arguments. The reduceRight method calls
	 * the callbackfn function one time for each element in the array.
	 * @param initialValue If initialValue is specified, it is used as the initial value to start
	 * the accumulation. The first call to the callbackfn function provides this value as an
	 * argument instead of an array value.
	 */
	reduceRight(
		callbackfn: (previousValue: TValue, currentValue: TValue, currentIndex: number, array: this) => number
	): number;
	reduceRight(
		callbackfn: (previousValue: TValue, currentValue: TValue, currentIndex: number, array: this) => number,
		initialValue: number
	): number;

	/**
	 * Calls the specified callback function for all the elements in an array, in descending order.
	 * The return value of the callback function is the accumulated result, and is provided as an
	 * argument in the next call to the callback function.
	 * @param callbackfn A function that accepts up to four arguments. The reduceRight method calls
	 * the callbackfn function one time for each element in the array.
	 * @param initialValue If initialValue is specified, it is used as the initial value to start
	 * the accumulation. The first call to the callbackfn function provides this value as an argument
	 * instead of an array value.
	 */
	reduceRight<U>(
		callbackfn: (previousValue: U, currentValue: TValue, currentIndex: TValue, array: this) => U,
		initialValue: U
	): U;

	/**
	 * Reverses the elements in an Array.
	 */
	reverse(): this;

	/**
	 * Sets a value or an array of values.
	 * @param array A typed or untyped array of values to set.
	 * @param offset The index in the current array at which the values are to be written.
	 */
	set(array: ArrayLike<TValue>, offset?: number): void;

	/**
	 * Returns a section of an array.
	 * @param start The beginning of the specified portion of the array.
	 * @param end The end of the specified portion of the array. This is exclusive of the element at the index 'end'.
	 */
	slice(start?: number, end?: number): TypedArray<TArrayBuffer, TValue>;

	/**
	 * Determines whether the specified callback function returns true for any element of an array.
	 * @param predicate A function that accepts up to three arguments. The some method calls
	 * the predicate function for each element in the array until the predicate returns a value
	 * which is coercible to the Boolean value true, or until the end of the array.
	 * @param thisArg An object to which the this keyword can refer in the predicate function.
	 * If thisArg is omitted, undefined is used as the this value.
	 */
	some(predicate: (value: TValue, index: number, array: this) => unknown, thisArg?: any): boolean;

	/**
	 * Sorts an array.
	 * @param compareFn Function used to determine the order of the elements. It is expected to return
	 * a negative value if first argument is less than second argument, zero if they're equal and a positive
	 * value otherwise. If omitted, the elements are sorted in ascending order.
	 * ```ts
	 * [11,2,22,1].sort((a, b) => a - b)
	 * ```
	 */
	sort(compareFn?: (a: TValue, b: TValue) => number): this;

	/**
	 * Gets a new Int8Array view of the ArrayBuffer store for this array, referencing the elements
	 * at begin, inclusive, up to end, exclusive.
	 * @param begin The index of the beginning of the array.
	 * @param end The index of the end of the array.
	 */
	subarray(begin?: number, end?: number): TypedArray<TArrayBuffer, TValue>;

	/**
	 * Converts a number to a string by using the current locale.
	 */
	toLocaleString(): string;

	/**
	 * Returns a string representation of an array.
	 */
	toString(): string;

	/** Returns the primitive value of the specified object. */
	valueOf(): this;

	[index: number]: TValue;
}

export interface TypedArrayConstructor {
	readonly prototype: TypedArray<ArrayBufferLike>;
	new (length: number): TypedArray<ArrayBuffer>;
	new (array: ArrayLike<number>): TypedArray<ArrayBuffer>;
	new <TArrayBuffer extends ArrayBufferLike = ArrayBuffer>(
		buffer: TArrayBuffer,
		byteOffset?: number,
		length?: number
	): TypedArray<TArrayBuffer>;
	new (array: ArrayLike<number> | ArrayBuffer): TypedArray<ArrayBuffer>;
	readonly BYTES_PER_ELEMENT: number;
}

/**
 * Grows a buffer if it isn't large enough
 * @returns The original buffer if resized successfully, or a newly created buffer
 */
export function extendBuffer<T extends ArrayBufferLike | ArrayBufferView>(buffer: T, newByteLength: number): T {
	if (buffer.byteLength >= newByteLength) return buffer;

	if (ArrayBuffer.isView(buffer)) {
		const newBuffer = extendBuffer(buffer.buffer, newByteLength);
		return new (buffer.constructor as ArrayBufferViewConstructor)(newBuffer, buffer.byteOffset, newByteLength) as T;
	}

	const isShared = typeof SharedArrayBuffer !== 'undefined' && buffer instanceof SharedArrayBuffer;

	// Note: If true, the buffer must be resizable/growable because of the first check.
	if (buffer.maxByteLength > newByteLength) {
		isShared ? buffer.grow(newByteLength) : (buffer as ArrayBuffer).resize(newByteLength);
		return buffer;
	}

	if (isShared) {
		const newBuffer = new SharedArrayBuffer(newByteLength) as T & SharedArrayBuffer;
		new Uint8Array(newBuffer).set(new Uint8Array(buffer));
		return newBuffer;
	}

	try {
		return (buffer as ArrayBuffer).transfer(newByteLength) as T;
	} catch {
		const newBuffer = new ArrayBuffer(newByteLength) as T & ArrayBuffer;
		new Uint8Array(newBuffer).set(new Uint8Array(buffer));
		return newBuffer;
	}
}

export function toUint8Array(buffer: ArrayBufferLike | ArrayBufferView): Uint8Array {
	if (buffer instanceof Uint8Array) return buffer;
	if (!ArrayBuffer.isView(buffer)) return new Uint8Array(buffer);
	return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/**
 * @hidden @deprecated
 */
export function initView<T extends ArrayBufferLike = ArrayBuffer>(
	view: Mutable<ArrayBufferView<T> & { BYTES_PER_ELEMENT?: number }>,
	buffer?: T | ArrayBufferView<T> | ArrayLike<number> | number,
	byteOffset?: number,
	byteLength?: number
) {
	if (typeof buffer == 'number') {
		view.buffer = new ArrayBuffer(buffer) as T;
		view.byteOffset = 0;
		view.byteLength = buffer;
		return;
	}

	if (
		!buffer
		|| buffer instanceof ArrayBuffer
		|| (globalThis.SharedArrayBuffer && buffer instanceof SharedArrayBuffer)
	) {
		const size =
			byteLength
			?? (view.constructor as any)?.size // Memium types
			?? buffer?.byteLength
			?? 0;
		view.buffer = buffer ?? (new ArrayBuffer(size) as T);
		view.byteOffset = byteOffset ?? 0;
		view.byteLength = size;
		return;
	}

	if (ArrayBuffer.isView(buffer)) {
		view.buffer = buffer.buffer;
		view.byteOffset = buffer.byteOffset;
		view.byteLength = buffer.byteLength;
		return;
	}

	const u8 = new Uint8Array((buffer as ArrayLike<number>).length) as Uint8Array<T>;

	view.buffer = u8.buffer;
	view.byteOffset = 0;
	view.byteLength = u8.length;

	for (let i = 0; i < u8.length; i++) {
		u8[i] = (buffer as ArrayLike<number>)[i];
	}
}

/** A generic view of an array buffer */
export class BufferView<T extends ArrayBufferLike = ArrayBufferLike> extends DataView<T> implements ArrayBufferView<T> {
	public constructor(
		_buffer?: T | ArrayBufferView<T> | ArrayLike<number> | number,
		_byteOffset?: number,
		_byteLength?: number
	) {
		const { buffer, byteOffset, byteLength } = new Uint8Array<any>(_buffer, _byteOffset, _byteLength);
		super(buffer, byteOffset, byteLength);
	}
}

for (const key of Object.getOwnPropertyNames(DataView.prototype)) {
	if (!key.startsWith('get') && !key.startsWith('set')) continue;

	Object.defineProperty(BufferView.prototype, key, {
		value: () => {
			throw new ReferenceError('Do not use DataView methods on a BufferView.');
		},
		writable: false,
		enumerable: false,
		configurable: false,
	});
}

BufferView satisfies ArrayBufferViewConstructor;

/** Creates a fixed-size array of a buffer view type */
export function BufferViewArray<T extends ArrayBufferViewConstructor>(element: T, size: number) {
	return class BufferViewArray<TArrayBuffer extends ArrayBufferLike = ArrayBuffer> extends Array {
		public readonly BYTES_PER_ELEMENT: number = size;

		declare public readonly buffer: TArrayBuffer;
		declare public readonly byteOffset: number;
		declare public readonly byteLength: number;

		public constructor(
			_buffer?: TArrayBuffer | ArrayBufferView<TArrayBuffer> | ArrayLike<number>,
			_byteOffset?: number,
			_byteLength?: number
		) {
			const { buffer, byteOffset, byteLength } = new Uint8Array<any>(_buffer, _byteOffset, _byteLength);
			const length = (byteLength ?? size) / size;

			if (!Number.isSafeInteger(length)) throw new Error('Invalid array length: ' + length);

			super(length);
			Object.assign(this, { buffer, byteOffset, byteLength });

			for (let i = 0; i < length; i++) {
				this[i] = new element(this.buffer, this.byteOffset + i * size, size);
			}
		}
	};
}

BufferView satisfies ArrayBufferViewConstructor;
