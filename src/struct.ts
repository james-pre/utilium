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
	type: PrimitiveType | StructStatic;
	offset: number;
	length?: number;
}

interface Metadata {
	options: Partial<StructOptions>;
	members: Map<string, Member>;
	size: number;
}

const metadata = Symbol('struct');

export interface StructStatic {
	[metadata]?: Metadata;
	new (): StructInstance;
	prototype: StructInstance;
}

export function isStructStatic(arg: unknown): arg is StructStatic {
	return typeof arg == 'function' && metadata in arg;
}

export interface StructInstance {
	constructor: StructStatic;
}

export function isStructInstance(arg: unknown): arg is StructInstance {
	return metadata in (arg?.constructor || {});
}

export function isStruct(arg: unknown): arg is StructInstance | StructStatic {
	return isStructInstance(arg) || isStructStatic(arg);
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
		for (const { name, type } of target[init] as MemberInit[]) {
			if (!isValidPrimitive(type) && !isStructStatic(type)) {
				throw new TypeError('Not a valid type: ' + type);
			}
			members.set(name, {
				offset: size,
				type: isValidPrimitive(type) ? normalizePrimitive(type) : type,
			});
			size += sizeof(type);
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
		const member: MemberInit = { name, type };
		if (length) {
			member.length = length;
		}
		target.constructor[init].push(member);
	};
}

export function serialize(instance: unknown): Uint8Array {
	if (!isStructInstance(instance)) {
		throw new TypeError('Can not serialize');
	}
	const { options, members } = instance.constructor[metadata];

	const buffer = new Uint8Array(sizeof(instance));
	const view = new DataView(buffer.buffer);

	for (const [name, { type, offset }] of members) {
		const value = instance[name];

		if (!isPrimitiveType(type)) {
			buffer.set(serialize(value), offset);
			continue;
		}

		const t = capitalize(type);
		const fn = <`set${typeof t}`>('set' + t);
		if (fn == 'setInt64') {
			view.setBigInt64(offset, value, !options.bigEndian);
			continue;
		}

		if (fn == 'setUint64') {
			view.setBigUint64(offset, value, !options.bigEndian);
			continue;
		}

		view[fn](offset, value, !options.bigEndian);
	}

	return buffer;
}

export function deserialize(instance: unknown, _buffer: ArrayBuffer | ArrayBufferView) {
	if (!isStructInstance(instance)) {
		throw new TypeError('Can not serialize');
	}
	const { options, members } = instance.constructor[metadata];

	const buffer = new Uint8Array('buffer' in _buffer ? _buffer.buffer : _buffer);

	const view = new DataView(buffer.buffer);

	for (const [name, { type, offset }] of members) {
		if (!isPrimitiveType(type)) {
			deserialize(new type(), buffer.slice(offset, sizeof(type)));
			continue;
		}

		const t = capitalize(type);
		const fn = <`get${typeof t}`>('get' + t);
		if (fn == 'getInt64') {
			instance[name] = view.getBigInt64(offset, !options.bigEndian);
			continue;
		}

		if (fn == 'getUint64') {
			instance[name] = view.getBigUint64(offset, !options.bigEndian);
			continue;
		}

		instance[name] = view[fn](offset, !options.bigEndian);
	}
}
