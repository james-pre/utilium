import * as primitive from './internal/primitives.js';
import type { DecoratorContext, InstanceLike, Member, MemberInit, Metadata, Options, Size, StaticLike } from './internal/struct.js';
import { checkInstance, checkStruct, isStatic, symbol_metadata, type MemberContext } from './internal/struct.js';
import { capitalize } from './string.js';
import type { ClassLike } from './types.js';
export * as Struct from './internal/struct.js';

/**
 * Gets the size in bytes of a type
 */
export function sizeof<T extends primitive.Valid | StaticLike | InstanceLike>(type: T): Size<T> {
	// primitive
	if (typeof type == 'string') {
		primitive.checkValid(type);

		return (+primitive.normalize(type).match(primitive.regex)![2] / 8) as Size<T>;
	}

	checkStruct(type);

	const struct = isStatic(type) ? type : type.constructor;

	return struct[symbol_metadata(struct)][Symbol.struct_metadata].size as Size<T>;
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
	return function _decorateStruct<const T extends StaticLike>(target: T, context: ClassDecoratorContext & DecoratorContext): T {
		context.metadata ??= {};
		context.metadata[Symbol.struct_init] ||= [];
		let size = 0;
		const members = new Map<string, Member>();
		for (const _ of context.metadata[Symbol.struct_init]!) {
			const { name, type, length } = _;
			if (!primitive.isValid(type) && !isStatic(type)) {
				throw new TypeError('Not a valid type: ' + type);
			}
			members.set(name, {
				offset: size,
				type: primitive.isValid(type) ? primitive.normalize(type) : type,
				length,
			});
			size += sizeof(type) * (length || 1);
			size = align(size, options.align || 1);
		}

		context.metadata[Symbol.struct_metadata] = { options, members, size } satisfies Metadata;
		return target;
	};
}

/**
 * Decorates a class member to be serialized
 */
export function member(type: primitive.Valid | ClassLike, length?: number) {
	return function <V>(value: V, context: MemberContext): V {
		let name = context.name;
		if (typeof name == 'symbol') {
			console.warn('Symbol used for struct member name will be coerced to string: ' + name.toString());
			name = name.toString();
		}

		if (!name) {
			throw new ReferenceError('Invalid name for struct member');
		}

		context.metadata ??= {};
		context.metadata[Symbol.struct_init] ||= [];
		context.metadata[Symbol.struct_init]!.push({ name, type, length } satisfies MemberInit);
		return value;
	};
}

/**
 * Serializes a struct into a Uint8Array
 */
export function serialize(instance: unknown): Uint8Array {
	checkInstance(instance);
	const { options, members } = instance.constructor[symbol_metadata(instance.constructor)][Symbol.struct_metadata];

	const buffer = new Uint8Array(sizeof(instance));
	const view = new DataView(buffer.buffer);

	for (const [name, { type, length, offset }] of members) {
		for (let i = 0; i < (length || 1); i++) {
			const iOff = offset + sizeof(type) * i;

			// @ts-expect-error 7053
			let value = length! > 0 ? instance[name][i] : instance[name];
			if (typeof value == 'string') {
				value = value.charCodeAt(0);
			}

			if (!primitive.isType(type)) {
				buffer.set(value ? serialize(value) : new Uint8Array(sizeof(type)), iOff);
				continue;
			}

			const Type = capitalize(type);
			const fn = ('set' + Type) as `set${typeof Type}`;
			if (fn == 'setInt64') {
				view.setBigInt64(iOff, BigInt(value), !options.bigEndian);
				continue;
			}

			if (fn == 'setUint64') {
				view.setBigUint64(iOff, BigInt(value), !options.bigEndian);
				continue;
			}

			view[fn](iOff, Number(value), !options.bigEndian);
		}
	}

	return buffer;
}

/**
 * Deserializes a struct from a Uint8Array
 */
export function deserialize(instance: unknown, _buffer: ArrayBufferLike | ArrayBufferView) {
	checkInstance(instance);
	const { options, members } = instance.constructor[symbol_metadata(instance.constructor)][Symbol.struct_metadata];

	const buffer = _buffer instanceof Uint8Array ? _buffer : new Uint8Array('buffer' in _buffer ? _buffer.buffer : _buffer);

	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

	for (const [name, { type, offset, length }] of members) {
		for (let i = 0; i < (length || 1); i++) {
			// @ts-expect-error 7053
			let object = length! > 0 ? instance[name] : instance;
			const key = length! > 0 ? i : name,
				iOff = offset + sizeof(type) * i;

			// @ts-expect-error 7053
			if (typeof instance[name] == 'string') {
				// @ts-expect-error 7053
				instance[name] = instance[name].slice(0, i) + String.fromCharCode(view.getUint8(iOff)) + instance[name].slice(i + 1);
				continue;
			}

			if (!primitive.isType(type)) {
				if (object[key] === null || object[key] === undefined) {
					continue;
				}
				deserialize(object[key], new Uint8Array(buffer.slice(iOff, iOff + sizeof(type))));
				continue;
			}

			if (length! > 0) {
				object ||= [];
			}

			const Type = capitalize(type);
			const fn = ('get' + Type) as `get${typeof Type}`;
			if (fn == 'getInt64') {
				object[key] = view.getBigInt64(iOff, !options.bigEndian);
				continue;
			}

			if (fn == 'getUint64') {
				object[key] = view.getBigUint64(iOff, !options.bigEndian);
				continue;
			}

			object[key] = view[fn](iOff, !options.bigEndian);
		}
	}
}

function _member<T extends primitive.Valid>(type: T) {
	function _structMemberDecorator<const V>(length: number): (value: V, context: MemberContext) => V;
	function _structMemberDecorator<const V>(value: V, context: MemberContext): V;
	function _structMemberDecorator<const V>(valueOrLength: V | number, context?: MemberContext): V | ((value: V, context: MemberContext) => V) {
		if (typeof valueOrLength == 'number') {
			return member(type, valueOrLength);
		}

		return member(type)(valueOrLength, context!);
	}
	return _structMemberDecorator;
}

/**
 * Shortcut types
 *
 * Instead of writing `@member(type)` you can write `@types.type`, or `@types.type(length)` for arrays
 */
export const types = Object.fromEntries(primitive.valids.map(t => [t, _member(t)])) as { [K in primitive.Valid]: ReturnType<typeof _member<K>> };
