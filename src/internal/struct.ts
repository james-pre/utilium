import { ClassLike } from '../types.js';
import * as primitive from './primitives.js';

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
	type: primitive.Type | Static;
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

export type Size<T extends primitive.Valid | StaticLike | InstanceLike> = T extends primitive.Valid ? primitive.Size<T> : T extends Like<infer M> ? M['size'] : number;
