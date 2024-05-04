import * as Struct from './internal/struct.js';
import { capitalize } from './string.js';
import { ClassLike } from './types.js';

export { Struct };

/**
 * Gets the size in bytes of a type
 */
export function sizeof(type: Struct.ValidPrimitiveType | ClassLike | object): number {
	// primitive
	if (typeof type == 'string') {
		if (!Struct.isValidPrimitive(type)) {
			throw new TypeError('Invalid primitive type: ' + type);
		}

		return +Struct.normalizePrimitive(type).match(Struct.numberRegex)[2] / 8;
	}

	if (!Struct.isStruct(type)) {
		throw new TypeError('Not a struct');
	}

	const meta: Struct.Metadata = Struct.metadata in type ? type[Struct.metadata] : type.constructor[Struct.metadata];
	return meta.size;
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
export function struct(options: Partial<Struct.Options> = {}) {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	return function (target: ClassLike, _?: ClassDecoratorContext) {
		target[Struct.init] ||= [];
		let size = 0;
		const members = new Map();
		for (const { name, type, length } of target[Struct.init] as Struct.MemberInit[]) {
			if (!Struct.isValidPrimitive(type) && !Struct.isStatic(type)) {
				throw new TypeError('Not a valid type: ' + type);
			}
			members.set(name, {
				offset: size,
				type: Struct.isValidPrimitive(type) ? Struct.normalizePrimitive(type) : type,
				length,
			});
			size += sizeof(type) * (length || 1);
			size = align(size, options.align || 1);
		}

		target[Struct.metadata] = { options, members, size } satisfies Struct.Metadata;
		delete target[Struct.init];
	};
}

/**
 * Decorates a class member to be serialized
 */
export function member(type: Struct.ValidPrimitiveType | ClassLike, length?: number) {
	return function (target: object, context?: ClassMemberDecoratorContext | string | symbol) {
		let name = typeof context == 'object' ? context.name : context;
		if (typeof name == 'symbol') {
			console.warn('Symbol used for struct member name will be coerced to string: ' + name.toString());
			name = name.toString();
		}

		if ((typeof target != 'object' || typeof target != 'function') && !('constructor' in target)) {
			throw new TypeError('Invalid member for struct field');
		}

		target.constructor[Struct.init] ||= [];
		target.constructor[Struct.init].push({ name, type, length } satisfies Struct.MemberInit);
	};
}

/**
 * Serializes a struct into a Uint8Array
 */
export function serialize(instance: unknown): Uint8Array {
	if (!Struct.isInstance(instance)) {
		throw new TypeError('Can not serialize, not a struct instance');
	}
	const { options, members } = instance.constructor[Struct.metadata];

	const buffer = new Uint8Array(sizeof(instance));
	const view = new DataView(buffer.buffer);

	for (const [name, { type, length, offset }] of members) {
		for (let i = 0; i < (length || 1); i++) {
			const iOff = offset + sizeof(type) * i;

			let value = length > 0 ? instance[name][i] : instance[name];
			if (typeof value == 'string') {
				value = value.charCodeAt(0);
			}

			if (!Struct.isPrimitiveType(type)) {
				buffer.set(value ? serialize(value) : new Uint8Array(sizeof(type)), iOff);
				continue;
			}

			const Type = capitalize(type);
			const fn = <`set${typeof Type}`>('set' + Type);
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
export function deserialize(instance: unknown, _buffer: ArrayBuffer | ArrayBufferView) {
	if (!Struct.isInstance(instance)) {
		throw new TypeError('Can not deserialize, not a struct instance');
	}
	const { options, members } = instance.constructor[Struct.metadata];

	const buffer = new Uint8Array('buffer' in _buffer ? _buffer.buffer : _buffer);

	const view = new DataView(buffer.buffer);

	for (const [name, { type, offset, length }] of members) {
		for (let i = 0; i < (length || 1); i++) {
			let object = length > 0 ? instance[name] : instance;
			const key = length > 0 ? i : name,
				iOff = offset + sizeof(type) * i;

			if (typeof instance[name] == 'string') {
				instance[name] = instance[name].slice(0, i) + String.fromCharCode(view.getUint8(iOff)) + instance[name].slice(i + 1);
				continue;
			}

			if (!Struct.isPrimitiveType(type)) {
				if (object[key] === null || object[key] === undefined) {
					continue;
				}
				deserialize(object[key], new Uint8Array(buffer.slice(iOff, sizeof(type))));
				continue;
			}

			if (length > 0) {
				object ||= [];
			}

			const Type = capitalize(type);
			const fn = <`get${typeof Type}`>('get' + Type);
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

function _member<T extends Struct.ValidPrimitiveType>(type: T) {
	function _(length?: number): (target: object, context?: string | symbol | ClassMemberDecoratorContext) => void;
	function _(target: object, context?: string | symbol | ClassMemberDecoratorContext): void;
	function _(targetOrLength: object | number, context?: string | symbol | ClassMemberDecoratorContext) {
		if (typeof targetOrLength == 'number') {
			return member(type, targetOrLength);
		}

		return member(type)(targetOrLength, context);
	}
	return _;
}

/**
 * Shortcut types
 *
 * Instead of writing `@member(type)` you can write `@types.type`, or `@types.type(length)` for arrays
 */
export const types = Object.fromEntries(Struct.validPrimitiveTypes.map(t => [t, _member(t)])) as { [K in Struct.ValidPrimitiveType]: ReturnType<typeof _member<K>> };
