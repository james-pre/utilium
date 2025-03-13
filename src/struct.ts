import { toUint8Array } from './buffer.js';
import { _debugLog } from './debugging.js';
import * as primitive from './internal/primitives.js';
import type {
	DecoratorContext,
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
import { checkInstance, checkStruct, isCustom, isStatic, symbol_metadata } from './internal/struct.js';
import { _throw } from './misc.js';
import { capitalize } from './string.js';
import type { ClassLike } from './types.js';
export * as Struct from './internal/struct.js';

function _memberTypeName(instance: Instance<Metadata>, name: string): string {
	const { struct } = instance.constructor[symbol_metadata(instance.constructor)];

	const member = struct.members.get(name);

	if (!member) throw new Error('Struct does not have member: ' + name);

	let base = `${instance.constructor.name}.${name} ${typeof member.type == 'string' ? member.type : isCustom(member.type) ? member.type.constructor.name : member.type.name}`;

	const length = _memberLength(instance, name, member.length);

	if (length != -1) base += `[${length}]`;

	return base;
}

/**
 * Gets the length of an array in a struct
 * @param length The numeric length or the name of the field which has the array length (like __counted_by)
 * @param name The name of the array field— only used for errors
 */
function _memberLength<T extends Metadata>(struct: Instance<T>, name: string, length?: string | number): number {
	if (length === undefined) return -1;
	if (typeof length != 'string')
		return Number.isSafeInteger(length) && length >= 0
			? length
			: _throw(new Error('Array lengths must be natural numbers'));

	if (!(length in struct)) throw new Error(`Can not use non-existent member to count ${name}: ` + length);

	const n = (struct as any)[length];

	if (typeof n != 'number') throw new Error(`Can not use "${name}" to count ${length}`);

	return n;
}

/**
 * Gets the size in bytes of a type
 */
export function sizeof<T extends TypeLike>(type: T): Size<T> {
	// primitive
	if (typeof type == 'string') {
		primitive.checkValid(type);

		return (+primitive.normalize(type).match(primitive.regex)![2] / 8) as Size<T>;
	}

	if (isCustom(type)) return type[Symbol.size] as Size<T>;

	checkStruct(type);

	const { struct } = isStatic(type)
		? type[symbol_metadata(type)]
		: type.constructor[symbol_metadata(type.constructor)];

	if (isStatic(type)) return struct.staticSize as Size<T>;

	let size = struct.staticSize;

	for (const [name, { type: memberType, length: key }] of struct.members) {
		if (typeof key != 'string') continue;
		size += sizeof(memberType) * _memberLength(type, key, name);
	}

	return size as Size<T>;
}

export function dynamicOffsets<const T extends Metadata>(instance: Instance<T>): Record<string, number> {
	const { struct } = instance.constructor[symbol_metadata(instance.constructor)];

	const offsets: Record<string, number> = {};
	let offset = 0;

	for (const [name, { type: memberType, length: rawLength }] of struct.members) {
		const length = _memberLength(instance, name, rawLength);
		offsets[name] = offset;
		offset += sizeof(memberType) * Math.abs(length);
	}

	return offsets;
}

/**
 * Returns the offset (in bytes) of a member in a struct.
 */
export function offsetof(type: StaticLike | InstanceLike, memberName: string): number {
	checkStruct(type);

	const constructor = isStatic(type) ? type : type.constructor;

	const { struct } = constructor[symbol_metadata(constructor)];

	if (isStatic(type) || !struct.isDynamic) {
		return (
			struct.members.get(memberName)?.staticOffset
			?? _throw(new Error('Struct does not have member: ' + memberName))
		);
	}

	let offset = 0;

	for (const [name, { type: memberType, length: rawLength }] of struct.members) {
		if (name == memberName) return offset;
		const length = _memberLength(type, name, rawLength);
		offset += sizeof(memberType) * Math.abs(length);
	}

	throw new Error('Struct does not have member: ' + memberName);
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
		context.metadata ??= {};
		context.metadata.struct ??= {};
		context.metadata.struct.init ??= [];

		let staticSize = 0,
			isDynamic = false;
		const members = new Map<string, Member>();
		for (const { name, type, length } of context.metadata.struct.init) {
			if (!primitive.isValid(type) && !isStatic(type)) throw new TypeError('Not a valid type: ' + type);

			members.set(name, {
				staticOffset: options.isUnion ? 0 : staticSize,
				type: primitive.isValid(type) ? primitive.normalize(type) : type,
				length,
			});
			const memberSize = typeof length == 'string' ? 0 : sizeof(type) * (length || 1);
			isDynamic ||= typeof length == 'string';
			staticSize = options.isUnion ? Math.max(staticSize, memberSize) : staticSize + memberSize;
			staticSize = align(staticSize, options.align || 1);

			_debugLog('define', target.name + '.' + name);
		}

		context.metadata.struct = { options, members, staticSize, isDynamic } satisfies Metadata;

		return target;
	};
}

/**
 * Decorates a class member to be serialized
 */
export function member(type: primitive.Valid | ClassLike, length?: number | string) {
	return function <V>(value: V, context: MemberContext): V {
		let name = context.name;
		if (typeof name == 'symbol') {
			console.warn('Symbol used for struct member name will be coerced to string: ' + name.toString());
			name = name.toString();
		}

		if (!name) throw new ReferenceError('Invalid name for struct member');

		context.metadata ??= {};
		context.metadata.struct ??= {};
		context.metadata.struct.init ??= [];
		context.metadata.struct.init.push({ name, type, length } satisfies MemberInit);
		return value;
	};
}

/**
 * Serializes a struct into a Uint8Array
 */
export function serialize(instance: unknown): Uint8Array {
	if (isCustom(instance) && typeof instance[Symbol.serialize] == 'function') return instance[Symbol.serialize]!();

	checkInstance(instance);
	const { options, members, isDynamic } = instance.constructor[symbol_metadata(instance.constructor)].struct;

	const buffer = new Uint8Array(sizeof(instance));
	const view = new DataView(buffer.buffer);

	const offsets = isDynamic && dynamicOffsets(instance);

	// for unions we should write members in ascending last modified order, but we don't have that info.
	for (const [name, { type, length: rawLength, staticOffset }] of members) {
		const length = _memberLength(instance, name, rawLength);

		_debugLog('serialize', _memberTypeName(instance, name), 'at', offsets ? offsets[name] : staticOffset);

		for (let i = 0; i < Math.abs(length); i++) {
			const iOff = (offsets ? offsets[name] : staticOffset) + sizeof(type) * i;

			let value = length != -1 ? instance[name][i] : instance[name];
			if (typeof value == 'string') {
				value = value.charCodeAt(0);
			}

			if (!primitive.isType(type)) {
				buffer.set(value ? serialize(value) : new Uint8Array(sizeof(type)), iOff);
				continue;
			}

			const fn = `set${capitalize(type)}` as const;

			if (fn == 'setInt64') {
				view.setBigInt64(iOff, BigInt(value), !options.bigEndian);
				continue;
			}

			if (fn == 'setUint64') {
				view.setBigUint64(iOff, BigInt(value), !options.bigEndian);
				continue;
			}

			if (fn == 'setInt128') {
				view.setBigUint64(iOff + (!options.bigEndian ? 0 : 8), value & primitive.mask64, !options.bigEndian);
				view.setBigInt64(iOff + (!options.bigEndian ? 8 : 0), value >> BigInt(64), !options.bigEndian);
				continue;
			}

			if (fn == 'setUint128') {
				view.setBigUint64(iOff + (!options.bigEndian ? 0 : 8), value & primitive.mask64, !options.bigEndian);
				view.setBigUint64(iOff + (!options.bigEndian ? 8 : 0), value >> BigInt(64), !options.bigEndian);
				continue;
			}

			if (fn == 'setFloat128') {
				view.setFloat64(iOff + (!options.bigEndian ? 0 : 8), Number(value), !options.bigEndian);
				view.setBigUint64(iOff + (!options.bigEndian ? 8 : 0), BigInt(0), !options.bigEndian);
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
	const buffer = toUint8Array(_buffer);

	if (isCustom(instance) && typeof instance[Symbol.deserialize] == 'function')
		return instance[Symbol.deserialize]!(buffer);

	checkInstance(instance);
	const { options, members, isDynamic } = instance.constructor[symbol_metadata(instance.constructor)].struct;

	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

	for (const [name, { type, length: rawLength, staticOffset }] of members) {
		const length = _memberLength(instance, name, rawLength);

		const offsets = isDynamic && dynamicOffsets(instance);

		_debugLog('deserialize', _memberTypeName(instance, name), 'at', offsets ? offsets[name] : staticOffset);

		for (let i = 0; i < Math.abs(length); i++) {
			let object = length != -1 ? instance[name] : instance;
			const key = length != -1 ? i : name,
				iOff = offsetof(instance, name) + sizeof(type) * i;

			if (typeof instance[name] == 'string') {
				instance[name] =
					instance[name].slice(0, i) + String.fromCharCode(view.getUint8(iOff)) + instance[name].slice(i + 1);
				continue;
			}

			if (!primitive.isType(type)) {
				if (object[key] === null || object[key] === undefined) {
					continue;
				}
				deserialize(object[key], new Uint8Array(buffer.subarray(iOff, iOff + sizeof(type))));
				continue;
			}

			if (length && length != -1) object ||= [];

			const fn = `get${capitalize(type)}` as const;
			if (fn == 'getInt64') {
				object[key] = view.getBigInt64(iOff, !options.bigEndian);
				continue;
			}

			if (fn == 'getUint64') {
				object[key] = view.getBigUint64(iOff, !options.bigEndian);
				continue;
			}

			if (fn == 'getInt128') {
				object[key] =
					(view.getBigInt64(iOff + (!options.bigEndian ? 8 : 0), !options.bigEndian) << BigInt(64))
					| view.getBigUint64(iOff + (!options.bigEndian ? 0 : 8), !options.bigEndian);
				continue;
			}

			if (fn == 'getUint128') {
				object[key] =
					(view.getBigUint64(iOff + (!options.bigEndian ? 8 : 0), !options.bigEndian) << BigInt(64))
					| view.getBigUint64(iOff + (!options.bigEndian ? 0 : 8), !options.bigEndian);
				continue;
			}

			if (fn == 'getFloat128') {
				object[key] = view.getFloat64(iOff + (!options.bigEndian ? 0 : 8), !options.bigEndian);
				continue;
			}

			if (iOff + sizeof(type) > buffer.byteLength) {
				console.error(iOff, sizeof(type), buffer.byteLength);
			}

			object[key] = view[fn](iOff, !options.bigEndian);
		}
	}
}

function _member<T extends primitive.Valid>(type: T) {
	function _structMemberDecorator<const V>(length: number | string): (value: V, context: MemberContext) => V;
	function _structMemberDecorator<const V>(value: V, context: MemberContext): V;
	function _structMemberDecorator<const V>(
		valueOrLength: V | number | string,
		context?: MemberContext
	): V | ((value: V, context: MemberContext) => V) {
		if (typeof valueOrLength == 'number' || typeof valueOrLength == 'string') {
			return member(type, valueOrLength as number);
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
export const types = Object.fromEntries(primitive.validNames.map(t => [t, _member(t)])) as {
	[K in primitive.Valid]: ReturnType<typeof _member<K>>;
};
