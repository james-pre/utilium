import { capitalize } from './string.js';
import { ClassLike } from './types.js';

export type PrimitiveType = `${'int' | 'uint'}${8 | 16 | 32 | 64}` | `float${32 | 64}`;
export type ValidPrimitiveType = PrimitiveType | Capitalize<PrimitiveType> | 'char';

const primitiveTypes = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'float32', 'float64'] satisfies PrimitiveType[];

const validPrimitiveTypes = [...primitiveTypes, ...primitiveTypes.map(t => capitalize(t)), 'char'] satisfies ValidPrimitiveType[];

const numberRegex = /^(u?int)(8|16|32|64)|(float)(32|64)$/i;

function normalizePrimitive(type: ValidPrimitiveType): PrimitiveType {
	return type == 'char' ? 'uint8' : <PrimitiveType>type.toLowerCase();
}

function isPrimitiveType(type: unknown): type is PrimitiveType {
	return numberRegex.test(type.toString());
}

function isValidPrimitive(type: unknown): type is ValidPrimitiveType {
	return type == 'char' || numberRegex.test(type.toString().toLowerCase());
}

interface MemberInit {
	name: string;
	type: string | ClassLike;
	length?: number;
}

const init = Symbol('struct_init');

/**
 * Options for struct initialization
 */
export interface StructOptions {
	align: number;
	bigEndian: boolean;
}

interface Member {
	type: PrimitiveType | Static;
	offset: number;
	length?: number;
}

interface Metadata {
	options: Partial<StructOptions>;
	members: Map<string, Member>;
	size: number;
}

const metadata = Symbol('struct');

interface Static {
	[metadata]?: Metadata;
	new (): Instance;
	prototype: Instance;
}

function isStatic(arg: unknown): arg is Static {
	return typeof arg == 'function' && metadata in arg;
}

interface Instance {
	constructor: Static;
}

function isInstance(arg: unknown): arg is Instance {
	return metadata in (arg?.constructor || {});
}

function isStruct(arg: unknown): arg is Instance | Static {
	return isInstance(arg) || isStatic(arg);
}

/**
 * Gets the size in bytes of a type
 */
export function sizeof(type: ValidPrimitiveType | ClassLike | object): number {
	// primitive
	if (typeof type == 'string') {
		if (!isValidPrimitive(type)) {
			throw new TypeError('Invalid primitive type: ' + type);
		}

		return +normalizePrimitive(type).match(numberRegex)[2] / 8;
	}

	if (!isStruct(type)) {
		throw new TypeError('Not a struct');
	}

	const meta: Metadata = metadata in type ? type[metadata] : type.constructor[metadata];
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
export function struct(options: Partial<StructOptions> = {}) {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	return function (target: ClassLike, _?: ClassDecoratorContext) {
		target[init] ||= [];
		let size = 0;
		const members = new Map();
		for (const { name, type, length } of target[init] as MemberInit[]) {
			if (!isValidPrimitive(type) && !isStatic(type)) {
				throw new TypeError('Not a valid type: ' + type);
			}
			members.set(name, {
				offset: size,
				type: isValidPrimitive(type) ? normalizePrimitive(type) : type,
				length,
			});
			size += sizeof(type) * (length || 1);
			size = align(size, options.align || 1);
		}

		target[metadata] = { options, members, size } satisfies Metadata;
		delete target[init];
	};
}

/**
 * Decorates a class member to be serialized
 */
export function member(type: ValidPrimitiveType | ClassLike, length?: number) {
	return function (target: object, context?: ClassMemberDecoratorContext | string | symbol) {
		let name = typeof context == 'object' ? context.name : context;
		if (typeof name == 'symbol') {
			console.warn('Symbol used for struct member name will be coerced to string: ' + name.toString());
			name = name.toString();
		}

		target.constructor[init] ||= [];
		target.constructor[init].push({ name, type, length } satisfies MemberInit);
	};
}

/**
 * Serializes a struct into a Uint8Array
 */
export function serialize(instance: unknown): Uint8Array {
	if (!isInstance(instance)) {
		throw new TypeError('Can not serialize, not a struct instance');
	}
	const { options, members } = instance.constructor[metadata];

	const buffer = new Uint8Array(sizeof(instance));
	const view = new DataView(buffer.buffer);

	for (const [name, { type, length, offset }] of members) {
		for (let i = 0; i < (length || 1); i++) {
			const iOff = offset + sizeof(type) * i;

			let value = length > 0 ? instance[name][i] : instance[name];
			if (typeof value == 'string') {
				value = value.charCodeAt(0);
			}

			if (!isPrimitiveType(type)) {
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
export function deserialize(instance: unknown, _buffer: Uint8Array) {
	if (!isInstance(instance)) {
		throw new TypeError('Can not deserialize, not a struct instance');
	}
	const { options, members } = instance.constructor[metadata];

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

			if (!isPrimitiveType(type)) {
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

function _member<T extends ValidPrimitiveType>(type: T) {
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
export const types = Object.fromEntries(validPrimitiveTypes.map(t => [t, _member(t)])) as { [K in ValidPrimitiveType]: ReturnType<typeof _member<K>> };
