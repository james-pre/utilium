import type { ClassLike } from '../types.js';
import type * as primitive from './primitives.js';

export interface MemberInit {
	name: string;
	type: string | ClassLike;
	length?: number;
}

export const init: unique symbol = Symbol('struct_init');

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

export const metadata: unique symbol = Symbol('struct');

export interface _DecoratorMetadata<T extends Metadata = Metadata> extends DecoratorMetadata {
	[metadata]?: T;
	[init]?: MemberInit[];
}

export interface DecoratorContext<T extends Metadata = Metadata> {
	metadata: _DecoratorMetadata<T>;
}

export type MemberContext = ClassMemberDecoratorContext & DecoratorContext;

export interface Static<T extends Metadata = Metadata> {
	[Symbol.metadata]: DecoratorMetadata & {
		[metadata]: T;
	};
	new (): Instance<T>;
	prototype: Instance<T>;
}

export interface StaticLike<T extends Metadata = Metadata> extends ClassLike {
	[Symbol.metadata]?: _DecoratorMetadata<T> | null;
}

export function isValidMetadata<T extends Metadata = Metadata>(
	arg: unknown
): arg is DecoratorMetadata & {
	[metadata]: T;
} {
	return arg != null && typeof arg == 'object' && metadata in arg;
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
	if (!Symbol?.metadata) {
		return;
	}
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
	const symbol_metadata = Symbol.metadata || Object.getOwnPropertySymbols(arg).find(s => s.description == 'Symbol.metadata');
	_polyfill_contextMetadata(arg);
	if (!symbol_metadata) {
		throw new ReferenceError('Could not get a reference to Symbol.metadata');
	}

	return symbol_metadata as typeof Symbol.metadata;
}

export function isStatic<T extends Metadata = Metadata>(arg: unknown): arg is Static<T> {
	return typeof arg == 'function' && symbol_metadata(arg as ClassLike) in arg && isValidMetadata(arg[symbol_metadata(arg as ClassLike)]);
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

export function checkInstance<T extends Metadata = Metadata>(arg: unknown): asserts arg is Instance<T> {
	if (!isInstance(arg)) {
		throw new TypeError((typeof arg == 'function' ? arg.name : typeof arg == 'object' && arg ? arg.constructor.name : arg) + ' is not a struct instance');
	}
}

export function isStruct<T extends Metadata = Metadata>(arg: unknown): arg is Instance<T> | Static<T> {
	return isInstance(arg) || isStatic(arg);
}

export function checkStruct<T extends Metadata = Metadata>(arg: unknown): asserts arg is Instance<T> | Static<T> {
	if (!isStruct(arg)) {
		throw new TypeError((typeof arg == 'function' ? arg.name : typeof arg == 'object' && arg ? arg.constructor.name : arg) + ' is not a struct');
	}
}

export type Like<T extends Metadata = Metadata> = InstanceLike<T> | StaticLike<T>;

export type Size<T extends primitive.Valid | StaticLike | InstanceLike> = T extends primitive.Valid ? primitive.Size<T> : T extends Like<infer M> ? M['size'] : number;
