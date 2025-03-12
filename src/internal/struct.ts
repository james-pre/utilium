import type { ClassLike } from '../types.js';
import type * as primitive from './primitives.js';

declare global {
	interface SymbolConstructor {
		/** User-defined size */
		readonly size: unique symbol;

		/** User-defined serialization */
		readonly serialize: unique symbol;

		/** User-defined deserialization */
		readonly deserialize: unique symbol;
	}
}

Object.assign(Symbol, {
	size: Symbol('uSize'),
	serialize: Symbol('uSerialize'),
	deserialize: Symbol('uDeserialize'),
});

export type TypeLike = UserDefined | Like | primitive.Valid;

export type Type = UserDefined | Static | primitive.Typename;

/**
 * Member initialization data
 * This is needed since class decorators are called *after* member decorators
 */
export interface MemberInit {
	name: string;
	type: string | ClassLike;
	length?: number;
}

/**
 * Options for struct initialization
 */
export interface Options {
	align: number;
	bigEndian: boolean;
	isUnion: boolean;
}

export interface Member {
	type: Type;
	offset: number;
	length?: number;
}

export interface Metadata {
	options: Partial<Options>;
	members: Map<string, Member>;
	size: number;
	init?: MemberInit[];
}

type _DecoratorMetadata<T extends Metadata = Metadata> = DecoratorMetadata & {
	struct?: Partial<T>;
};

export interface DecoratorContext<T extends Metadata = Metadata> {
	metadata: _DecoratorMetadata<T>;
}

export type MemberContext = ClassMemberDecoratorContext & DecoratorContext;

export interface Static<T extends Metadata = Metadata> {
	[Symbol.metadata]: { struct: T };
	new (): Instance<T>;
	prototype: Instance<T>;
}

export interface StaticLike<T extends Metadata = Metadata> extends ClassLike {
	[Symbol.metadata]?: _DecoratorMetadata<T> | null;
}

export function isValidMetadata<T extends Metadata = Metadata>(
	arg: unknown
): arg is DecoratorMetadata & {
	struct: T;
} {
	return arg != null && typeof arg == 'object' && 'struct' in arg;
}

/**
 * Polyfill Symbol.metadata
 * @see https://github.com/microsoft/TypeScript/issues/53461
 */
(Symbol as { metadata: symbol }).metadata ??= Symbol.for('Symbol.metadata');

/**
 * Polyfill context.metadata
 * @see https://github.com/microsoft/TypeScript/issues/53461
 */
export function _polyfill_contextMetadata(target: object): void {
	if (!Symbol?.metadata || Symbol.metadata in target) return;

	Object.defineProperty(target, Symbol.metadata, {
		enumerable: true,
		configurable: true,
		writable: true,
		value: Object.create(null),
	});
}

/**
 * Gets a reference to Symbol.metadata, even on platforms that do not expose it globally (like Node)
 */
export function symbol_metadata(arg: ClassLike): typeof Symbol.metadata {
	const symbol_metadata =
		Symbol.metadata || Object.getOwnPropertySymbols(arg).find(s => s.description == 'Symbol.metadata');
	_polyfill_contextMetadata(arg);
	if (!symbol_metadata) {
		throw new ReferenceError('Could not get a reference to Symbol.metadata');
	}

	return symbol_metadata as typeof Symbol.metadata;
}

export function isStatic<T extends Metadata = Metadata>(arg: unknown): arg is Static<T> {
	return (
		typeof arg == 'function'
		&& symbol_metadata(arg as ClassLike) in arg
		&& isValidMetadata(arg[symbol_metadata(arg as ClassLike)])
	);
}

export interface Instance<T extends Metadata = Metadata> {
	constructor: Static<T>;
}

export interface InstanceLike<T extends Metadata = Metadata> {
	constructor: StaticLike<T>;
}

export function isInstance<T extends Metadata = Metadata>(arg: unknown): arg is Instance<T> {
	return arg != null && typeof arg == 'object' && isStatic(arg.constructor);
}

export function checkInstance<T extends Metadata = Metadata>(
	arg: unknown
): asserts arg is Instance<T> & Record<keyof any, any> {
	if (isInstance(arg)) return;
	throw new TypeError(
		(typeof arg == 'function' ? arg.name : typeof arg == 'object' && arg ? arg.constructor.name : arg)
			+ ' is not a struct instance'
	);
}

export function isStruct<T extends Metadata = Metadata>(arg: unknown): arg is Instance<T> | Static<T> {
	return isInstance(arg) || isStatic(arg);
}

export function checkStruct<T extends Metadata = Metadata>(arg: unknown): asserts arg is Instance<T> | Static<T> {
	if (isStruct(arg)) return;
	throw new TypeError(
		(typeof arg == 'function' ? arg.name : typeof arg == 'object' && arg ? arg.constructor.name : arg)
			+ ' is not a struct'
	);
}

export interface UserDefined {
	readonly [Symbol.size]: number;
	[Symbol.serialize](): Uint8Array;
	[Symbol.deserialize](value: Uint8Array): void;
}

export function isUserDefined(arg: unknown): arg is UserDefined {
	return (
		typeof arg == 'object'
		&& arg != null
		&& Symbol.size in arg
		&& Symbol.serialize in arg
		&& Symbol.deserialize in arg
	);
}

export type Like<T extends Metadata = Metadata> = InstanceLike<T> | StaticLike<T>;

export type Size<T extends TypeLike> = T extends { readonly [Symbol.size]: infer S }
	? S
	: T extends primitive.Valid
		? primitive.Size<T>
		: T extends Like<infer M>
			? M['size']
			: number;
