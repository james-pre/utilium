import type { ArrayBufferViewConstructor } from './buffer.js';
import { _debugLog } from './debugging.js';
import * as primitive from './internal/primitives.js';
import type {
	AccessorDecorator,
	DecoratorContext,
	DecoratorResult,
	DecoratorTarget,
	Instance,
	InstanceLike,
	Member,
	MemberContext,
	MemberInit,
	Metadata,
	Options,
	Size,
	StaticLike,
	TypeLike,
} from './internal/struct.js';
import {
	_polyfill_metadata,
	checkStruct,
	initMetadata,
	isCustom,
	isInstance,
	isStatic,
	isStruct,
} from './internal/struct.js';
import { _throw } from './misc.js';
import { capitalize } from './string.js';
import type { ClassLike } from './types.js';
export * as Struct from './internal/struct.js';

/**
 * Gets the size in bytes of a type
 */
export function sizeof<T extends TypeLike>(type: T | T[]): Size<T> {
	if (type === undefined || type === null) return 0 as Size<T>;

	if (Array.isArray(type)) {
		let size = 0;

		for (let i = 0; i < type.length; i++) {
			size += sizeof(type[i]);
		}

		return size as Size<T>;
	}

	// primitive or character
	if (typeof type == 'string') {
		primitive.checkValid(type);

		return (+primitive.normalize(type).match(primitive.regex)![2] / 8) as Size<T>;
	}

	if (isCustom(type)) return type[Symbol.size] as Size<T>;

	checkStruct(type);

	const constructor = isStatic(type) ? type : type.constructor;
	_polyfill_metadata(constructor);
	const { struct } = constructor[Symbol.metadata];

	let size = struct.staticSize;

	if (isStatic(type)) return size as Size<T>;

	for (const member of struct.members.values()) {
		const value = (type as any)[member.name];

		if (isInstance(value) && value.constructor[Symbol.metadata].struct.isDynamic) {
			if (struct.isUnion) size = Math.max(size, sizeof(value));
			else size += sizeof(value);
			continue;
		}

		if (typeof member.length != 'string') continue;

		let subSize = 0;

		for (let i = 0; i < (type as any)[member.length]; i++) {
			subSize += sizeof(isStruct(value[i]) ? value[i] : member.type);
		}

		if (struct.isUnion) size = Math.max(size, subSize);
		else size += subSize;
	}

	return size as Size<T>;
}

/**
 * Returns the offset (in bytes) of a member in a struct.
 */
export function offsetof(type: StaticLike | InstanceLike, memberName: string): number {
	checkStruct(type);

	const constructor = isStatic(type) ? type : type.constructor;

	_polyfill_metadata(constructor);
	const { struct } = constructor[Symbol.metadata];

	if (isStatic(type) || !struct.isDynamic) {
		return (
			struct.members.get(memberName)?.staticOffset
			?? _throw(new Error('Struct does not have member: ' + memberName))
		);
	}

	let offset = 0;

	for (const member of struct.members.values()) {
		if (member.name == memberName) return offset;

		const value = (type as any)[member.name];
		offset += sizeof(isStruct(value) ? value : member.type);
	}

	throw new Error('Struct does not have member: ' + memberName);
}

function _toDecl(init: MemberInit): string {
	let decl = `${typeof init.type == 'string' ? init.type : init.type.name} ${init.name}`;

	if (init.length !== undefined) decl += `[${init.length}]`;

	return decl;
}

/**
 * Aligns a number
 */
export function align(value: number, alignment: number): number {
	return Math.ceil(value / alignment) * alignment;
}

/**
 * Decorates a class as a struct
 */
export function struct(options: Partial<Options> = {}) {
	return function _decorateStruct<const T extends StaticLike>(
		target: T,
		context: ClassDecoratorContext & DecoratorContext
	): T {
		const members = new Map<string, Member>();

		let staticSize = 0,
			isDynamic = false;

		for (const { name, type, length } of initMetadata(context)) {
			if (typeof length == 'string') {
				const countedBy = members.get(length);

				if (!countedBy) throw new Error(`"${length}" is undefined or declared after "${name}"`);

				if (!primitive.isType(countedBy.type))
					throw new Error(`"${length}" is not a number and cannot be used to count "${name}"`);
			}

			let decl = `${typeof type == 'string' ? type : type.name} ${name}`;

			if (length !== undefined) decl += `[${length}]`;

			const member = {
				name,
				staticOffset: options.isUnion ? 0 : isDynamic ? -1 : staticSize,
				type: primitive.isValid(type) ? primitive.normalize(type) : type,
				length,
				decl,
			};

			members.set(name, member);

			const memberSize =
				typeof length == 'string' || (isStatic(type) && type[Symbol.metadata].struct.isDynamic)
					? 0
					: sizeof(type) * (length || 1);

			isDynamic ||= isStatic(type) ? type[Symbol.metadata].struct.isDynamic : typeof length == 'string';
			staticSize = options.isUnion ? Math.max(staticSize, memberSize) : staticSize + memberSize;
			staticSize = align(staticSize, options.align || 1);

			_debugLog('define', target.name + '.' + name);
		}

		context.metadata.struct = {
			options,
			members,
			staticSize,
			isDynamic,
			isUnion: options.isUnion ?? false,
		} satisfies Metadata;

		return target;
	};
}

interface View<T extends ArrayBufferLike = ArrayBuffer> {
	buffer: T;
	byteOffset: number;
	byteLength: number;
}

function _initView<T extends ArrayBufferLike = ArrayBuffer>(
	view: View<T>,
	buffer?: T | ArrayBufferView<T> | ArrayLike<number>,
	byteOffset?: number,
	byteLength?: number
) {
	if (
		!buffer
		|| buffer instanceof ArrayBuffer
		|| (globalThis.SharedArrayBuffer && buffer instanceof globalThis.SharedArrayBuffer)
	) {
		const { staticSize = 0 } = (view.constructor as any)?.[Symbol.metadata]?.struct ?? {};
		view.buffer = buffer ?? (new ArrayBuffer(staticSize) as T);
		view.byteOffset = byteOffset ?? 0;
		view.byteLength = byteLength ?? staticSize;
		return;
	}

	if (ArrayBuffer.isView(buffer)) {
		view.buffer = buffer.buffer;
		view.byteOffset = buffer.byteOffset;
		view.byteLength = buffer.byteLength;
		return;
	}

	const array = buffer as ArrayLike<number>;

	view.buffer = new ArrayBuffer(array.length) as T;
	view.byteOffset = 0;
	view.byteLength = array.length;

	const data = new Uint8Array(view.buffer);
	for (let i = 0; i < array.length; i++) {
		data[i] = array[i];
	}
}

export class StructView implements ArrayBufferView {
	public readonly buffer!: ArrayBufferLike;
	public readonly byteOffset!: number;
	public readonly byteLength!: number;

	public constructor(
		buffer?: ArrayBufferLike | ArrayBufferView | ArrayLike<number>,
		byteOffset?: number,
		byteLength?: number
	) {
		_initView(this, buffer, byteOffset, byteLength);
	}
}

export class ArrayView {
	public constructor(
		public readonly buffer: ArrayBufferLike,
		public readonly byteOffset: number,
		public readonly length: number
	) {}
}

/** Mixin */
export function _struct<T extends ClassLike>(base: T): StaticLike & T {
	// @ts-expect-error 2545
	abstract class __struct__ extends base {
		public readonly buffer!: ArrayBufferLike;
		public readonly byteOffset!: number;
		public readonly byteLength!: number;

		public constructor(
			buffer?: ArrayBufferLike | ArrayBufferView | ArrayLike<number>,
			byteOffset?: number,
			byteLength?: number
		) {
			super();

			_initView(this, buffer, byteOffset, byteLength);
		}
	}

	return __struct__;
}

/**
 * Decorates a class member to be serialized
 */
export function member<V>(type: primitive.Valid | StaticLike, length?: number | string) {
	return function (value: DecoratorTarget<V>, context: MemberContext): DecoratorResult<V> {
		let name = context.name;
		if (typeof name == 'symbol') {
			console.warn('Symbol used for struct member name will be coerced to string: ' + name.toString());
			name = name.toString();
		}

		if (!name) throw new ReferenceError('Invalid name for struct member');

		if (!primitive.isValid(type) && !isStatic(type)) throw new TypeError('Not a valid type: ' + type);

		const init = {
			name,
			type: primitive.isValid(type) ? primitive.normalize(type) : type,
			length,
		} satisfies MemberInit;

		initMetadata(context).push(init);

		if (context.kind != 'accessor') throw new Error('Member must be an accessor');

		return {
			get(this: Instance): V {
				return _get(this, init) as V;
			},
			set(this: Instance, value: V) {
				return _set(this, init, value);
			},
		};
	};
}

/** Gets the length of a member */
function _memberLength<T extends Metadata>(instance: Instance<T>, length?: number | string): number {
	if (length === undefined) return -1;
	if (typeof length == 'string') return instance[length];
	return Number.isSafeInteger(length) && length >= 0
		? length
		: _throw(new Error('Array lengths must be natural numbers'));
}

// temporary
const __options__ = { bigEndian: false };

function _set(instance: Instance, init: MemberInit, value: any, index?: number) {
	const { name, type, length: rawLength } = init;
	const length = _memberLength(instance, rawLength);
	const view = new DataView(instance.buffer, instance.byteOffset, instance.byteLength);

	_debugLog('\t', _toDecl(init));

	if (length && length != -1 && typeof index != 'number') {
		for (let i = 0; i < length; i++) _set(instance, init, value, i);
		return;
	}

	const offset = offsetof(instance, name) + (index ?? 0) * sizeof(type);

	if (typeof value == 'string') {
		value = value.charCodeAt(0);
	}

	if (!primitive.isType(type)) {
		if (!isInstance(value)) return _debugLog(`Tried to set "${name}" to a non-instance value`);

		return;
	}

	const fn = `set${capitalize(type)}` as const;

	if (fn == 'setInt64') {
		view.setBigInt64(offset, BigInt(value), !__options__.bigEndian);
		return;
	}

	if (fn == 'setUint64') {
		view.setBigUint64(offset, BigInt(value), !__options__.bigEndian);
		return;
	}

	if (fn == 'setInt128') {
		view.setBigUint64(offset + (!__options__.bigEndian ? 0 : 8), value & primitive.mask64, !__options__.bigEndian);
		view.setBigInt64(offset + (!__options__.bigEndian ? 8 : 0), value >> BigInt(64), !__options__.bigEndian);
		return;
	}

	if (fn == 'setUint128') {
		view.setBigUint64(offset + (!__options__.bigEndian ? 0 : 8), value & primitive.mask64, !__options__.bigEndian);
		view.setBigUint64(offset + (!__options__.bigEndian ? 8 : 0), value >> BigInt(64), !__options__.bigEndian);
		return;
	}

	if (fn == 'setFloat128') {
		view.setFloat64(offset + (!__options__.bigEndian ? 0 : 8), Number(value), !__options__.bigEndian);
		view.setBigUint64(offset + (!__options__.bigEndian ? 8 : 0), BigInt(0), !__options__.bigEndian);
		return;
	}

	view[fn](offset, Number(value), !__options__.bigEndian);
}

function _get(instance: Instance, init: MemberInit, index?: number) {
	const { name, type, length: rawLength } = init;
	const length = _memberLength(instance, rawLength);

	// We need to proxy arrays
	if (length && length != -1 && typeof index != 'number') {
		const jsName = primitive.isType(type) && primitive.jsName(type);

		if (jsName) {
			const ctor = globalThis[`${jsName}Array`] as ArrayBufferViewConstructor; // cast otherwise TS expects 0-1 arguments
			return new ctor(instance.buffer, instance.byteOffset, length);
		}

		return new Proxy(
			{
				length,
			},
			{
				get(target, index) {
					if (index in target) return target[index as keyof typeof target];
					const i = parseInt(index.toString());
					if (!Number.isSafeInteger(i)) throw new Error('Invalid index: ' + index.toString());
					return _get(instance, init, i);
				},
				set(target, index, value) {
					if (index in target) {
						target[index as keyof typeof target] = value;
						return true;
					}

					const i = parseInt(index.toString());
					if (!Number.isSafeInteger(i)) throw new Error('Invalid index: ' + index.toString());
					_set(instance, init, i, value);
					return true;
				},
			}
		);
	}

	const offset = offsetof(instance, name) + (index ?? 0) * sizeof(type);

	const view = new DataView(instance.buffer, instance.byteOffset, instance.byteLength);

	_debugLog('\t', _toDecl(init));

	if (!primitive.isType(type)) {
		return new type(instance.buffer, offset, sizeof(type));
	}

	if (type == 'int128') {
		return (
			(view.getBigInt64(offset + (!__options__.bigEndian ? 8 : 0), !__options__.bigEndian) << BigInt(64))
			| view.getBigUint64(offset + (!__options__.bigEndian ? 0 : 8), !__options__.bigEndian)
		);
	}

	if (type == 'uint128') {
		return (
			(view.getBigUint64(offset + (!__options__.bigEndian ? 8 : 0), !__options__.bigEndian) << BigInt(64))
			| view.getBigUint64(offset + (!__options__.bigEndian ? 0 : 8), !__options__.bigEndian)
		);
	}

	if (type == 'float128') {
		return view.getFloat64(offset + (!__options__.bigEndian ? 0 : 8), !__options__.bigEndian);
	}

	return view[`get${primitive.jsName(type)}` as const](offset, !__options__.bigEndian);
}

function _member<T extends primitive.Valid>(type: T) {
	function _structMemberDecorator<V>(length: number | string): AccessorDecorator<V>;
	function _structMemberDecorator<V>(value: DecoratorTarget<V>, context: MemberContext): DecoratorResult<V>;
	function _structMemberDecorator<V>(
		valueOrLength: DecoratorTarget<V> | number | string,
		context?: MemberContext
	): AccessorDecorator<V> | DecoratorResult<V> {
		return typeof valueOrLength == 'number' || typeof valueOrLength == 'string'
			? member<V>(type, valueOrLength)
			: member<V>(type)(valueOrLength, context!);
	}

	return _structMemberDecorator;
}

/**
 * Shortcut types
 *
 * Instead of writing `@member(type)` you can write `@types.type`, or `@types.type(length)` for arrays
 */
export const types = Object.fromEntries(primitive.validNames.map(t => [t, _member(t)])) as {
	[K in primitive.Valid]: ReturnType<typeof _member<K>>;
};
