import { capitalize } from '../string.js';
import { ClassLike } from '../types.js';

export type PrimitiveType = `${'int' | 'uint'}${8 | 16 | 32 | 64}` | `float${32 | 64}`;
export type ValidPrimitiveType = PrimitiveType | Capitalize<PrimitiveType> | 'char';

export const primitiveTypes = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'float32', 'float64'] satisfies PrimitiveType[];

export const validPrimitiveTypes = [...primitiveTypes, ...primitiveTypes.map(t => capitalize(t)), 'char'] satisfies ValidPrimitiveType[];

export const numberRegex = /^(u?int)(8|16|32|64)|(float)(32|64)$/i;

export function normalizePrimitive(type: ValidPrimitiveType): PrimitiveType {
	return type == 'char' ? 'uint8' : <PrimitiveType>type.toLowerCase();
}

export function isPrimitiveType(type: { toString(): string }): type is PrimitiveType {
	return numberRegex.test(type.toString());
}

export function isValidPrimitive(type: { toString(): string }): type is ValidPrimitiveType {
	return type == 'char' || numberRegex.test(type.toString().toLowerCase());
}

export interface MemberInit {
	name: string;
	type: string | ClassLike;
	length?: number;
}

export const init = Symbol('struct_init');

/**
 * Options for struct initialization
 */
export interface Options {
	align: number;
	bigEndian: boolean;
}

export interface Member {
	type: PrimitiveType | Static;
	offset: number;
	length?: number;
}

export interface Metadata {
	options: Partial<Options>;
	members: Map<string, Member>;
	size: number;
}

export const metadata = Symbol('struct');

export interface Static {
	[metadata]: Metadata;
	new (): Instance;
	prototype: Instance;
}

export interface StaticLike extends ClassLike {
	[metadata]?: Metadata;
	[init]?: MemberInit[];
}

export function isStatic(arg: unknown): arg is Static {
	return typeof arg == 'function' && metadata in arg;
}

export interface Instance {
	constructor: Static;
}

export interface InstanceLike {
	constructor: StaticLike;
}

export function isInstance(arg: unknown): arg is Instance {
	return metadata in (arg?.constructor || {});
}

export function isStruct(arg: unknown): arg is Instance | Static {
	return isInstance(arg) || isStatic(arg);
}
