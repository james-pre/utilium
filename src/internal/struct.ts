import { capitalize } from '../string.js';
import { ClassLike } from '../types.js';

type BitsToBytes = {
	'8': 1;
	'16': 2;
	'32': 4;
	'64': 8;
};

export type PrimitiveSize<T extends string> = T extends `${'int' | 'uint' | 'float'}${infer bits}` ? (bits extends keyof BitsToBytes ? BitsToBytes[bits] : never) : never;
export type Primitive = `${'int' | 'uint'}${8 | 16 | 32 | 64}` | `float${32 | 64}`;
export type ValidPrimitive = Primitive | Capitalize<Primitive> | 'char';

export const primitives = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'float32', 'float64'] satisfies Primitive[];

export const validPrimitives = [...primitives, ...primitives.map(t => capitalize(t)), 'char'] satisfies ValidPrimitive[];

export const numberRegex = /^(u?int)(8|16|32|64)|(float)(32|64)$/i;

export type NormalizePrimitive<T extends ValidPrimitive> = T extends 'char' ? 'uint8' : Uncapitalize<T>;

export function normalizePrimitive<T extends ValidPrimitive>(type: T): NormalizePrimitive<T> {
	return (type == 'char' ? 'uint8' : type.toLowerCase()) as NormalizePrimitive<T>;
}

export function isPrimitiveType(type: { toString(): string }): type is Primitive {
	return numberRegex.test(type.toString());
}

export function isValidPrimitive(type: { toString(): string }): type is ValidPrimitive {
	return type == 'char' || numberRegex.test(type.toString().toLowerCase());
}

export interface MemberInit {
	name: string;
	type: string | ClassLike;
	length?: number;
}

export const init = Symbol('struct_init');

export type init = typeof init;

/**
 * Options for struct initialization
 */
export interface Options {
	align: number;
	bigEndian: boolean;
}

export interface Member {
	type: Primitive | Static;
	offset: number;
	length?: number;
}

export interface Metadata {
	options: Partial<Options>;
	members: Map<string, Member>;
	size: number;
}

export const metadata = Symbol('struct');

export type metadata = typeof metadata;

export interface Static<T extends Metadata = Metadata> {
	[metadata]: T;
	new (): Instance;
	prototype: Instance;
}

export interface StaticLike<T extends Metadata = Metadata> extends ClassLike {
	[metadata]?: T;
	[init]?: MemberInit[];
}

export function isStatic<T extends Metadata = Metadata>(arg: unknown): arg is Static<T> {
	return typeof arg == 'function' && metadata in arg;
}

export interface Instance<T extends Metadata = Metadata> {
	constructor: Static<T>;
}

export interface InstanceLike<T extends Metadata = Metadata> {
	constructor: StaticLike<T>;
}

export function isInstance<T extends Metadata = Metadata>(arg: unknown): arg is Instance<T> {
	return metadata in (arg?.constructor || {});
}

export function isStruct<T extends Metadata = Metadata>(arg: unknown): arg is Instance<T> | Static<T> {
	return isInstance(arg) || isStatic(arg);
}

export type Like<T extends Metadata = Metadata> = InstanceLike<T> | StaticLike<T>;

export type Size<T extends ValidPrimitive | StaticLike | InstanceLike> = T extends ValidPrimitive ? PrimitiveSize<T> : T extends Like<infer M> ? M['size'] : number;
