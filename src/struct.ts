import { capitalize } from './string.js';
import { ClassLike } from './types.js';

export type PrimitiveType = `${'int' | 'uint'}${8 | 16 | 32 | 64}` | `float${32 | 64}`;
export type ValidPrimitiveType = PrimitiveType | Capitalize<PrimitiveType> | 'char';

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

export function align(value: number, alignment: number): number {
	return Math.ceil(value / alignment) * alignment;
}

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

export function member(type: ValidPrimitiveType | ClassLike, length?: number) {
	return function (target: unknown, context?: ClassMemberDecoratorContext | string | symbol) {
		let name = typeof context == 'object' ? context.name : context;
		if (typeof name == 'symbol') {
			console.warn('Symbol used for struct member name will be coerced to string: ' + name.toString());
			name = name.toString();
		}

		target.constructor[init] ||= [];
		target.constructor[init].push({ name, type, length } satisfies MemberInit);
	};
}

export function serialize(instance: unknown): Uint8Array {
	if (!isInstance(instance)) {
		throw new TypeError('Can not serialize');
	}
	const { options, members } = instance.constructor[metadata];

	const buffer = new Uint8Array(sizeof(instance));
	const view = new DataView(buffer.buffer);

	for (const [name, { type, length, offset }] of members) {
		for (let i = 0; i < (length || 1); i++) {
			const value = length > 0 ? instance[name][i] : instance[name],
				iOff = offset + sizeof(type) * i;

			if (!isPrimitiveType(type)) {
				buffer.set(serialize(value), iOff);
				continue;
			}

			const t = capitalize(type);
			const fn = <`set${typeof t}`>('set' + t);
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

export function deserialize(instance: unknown, _buffer: ArrayBuffer | ArrayBufferView) {
	if (!isInstance(instance)) {
		throw new TypeError('Can not serialize');
	}
	const { options, members } = instance.constructor[metadata];

	const buffer = new Uint8Array('buffer' in _buffer ? _buffer.buffer : _buffer);

	const view = new DataView(buffer.buffer);

	for (const [name, { type, offset, length }] of members) {
		for (let i = 0; i < (length || 1); i++) {
			const object = length > 0 ? instance[name] : instance,
				key = length > 0 ? i : name,
				iOff = offset + sizeof(type) * i;
			if (!isPrimitiveType(type)) {
				object[key] = deserialize(new type(), buffer.slice(iOff, sizeof(type)));
				continue;
			}

			const t = capitalize(type);
			const fn = <`get${typeof t}`>('get' + t);
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
