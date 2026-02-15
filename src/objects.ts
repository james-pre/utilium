// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2025 James Prevett
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Expand, UnionToTuple } from './types.js';

export function filterObject<O extends object, R extends object>(
	object: O,
	predicate: (key: keyof O, value: O[keyof O]) => boolean
): R {
	const entries = Object.entries(object) as [keyof O, O[keyof O]][];
	return Object.fromEntries(entries.filter(([key, value]) => predicate(key, value))) as R;
}

export function pick<T extends object, K extends keyof T>(object: T, ...keys: readonly K[]): Pick<T, K>;
export function pick<T extends object, K extends keyof T>(object: T, ...keys: readonly (readonly K[])[]): Pick<T, K>;
export function pick<T extends object, K extends keyof T>(
	object: T,
	...keys: readonly K[] | readonly (readonly K[])[]
): Pick<T, K> {
	const picked = {} as Pick<T, K>;
	for (const key of keys.flat() as K[]) {
		picked[key] = object[key];
	}
	return picked;
}

/** @see https://github.com/microsoft/TypeScript/issues/49656 */
export type Omit<T, K extends PropertyKey> = { [P in keyof T as Exclude<P, K>]: T[P] };

export function omit<T extends object, K extends keyof T>(object: T, ...keys: readonly K[]): Omit<T, K>;
export function omit<T extends object, K extends keyof T>(object: T, ...keys: readonly (readonly K[])[]): Omit<T, K>;
export function omit<T extends object, K extends keyof T>(
	object: T,
	...keys: readonly K[] | readonly (readonly K[])[]
): Omit<T, K> {
	return filterObject<T, Omit<T, K>>(object, key => !keys.flat().includes(key as K));
}

export function assignWithDefaults<To extends Record<keyof any, any>, From extends Partial<To>>(
	to: To,
	from: From,
	defaults: Partial<To> = to
): void {
	const keys = new Set<keyof To | keyof From>([...Object.keys(to), ...Object.keys(from)]);
	for (const key of keys) {
		try {
			to[key] = from[key] ?? defaults[key] ?? to[key];
		} catch {
			// Do nothing
		}
	}
}

/**
 * Returns whether `value` is not a primitive.
 *
 * This function is only useful for the type check,
 * you can do `Object(v) === v` otherwise.
 */
export function isObject(value: unknown): value is object {
	return Object(value) === value;
}

export type DeepAssign<To extends object, From extends object> = {
	[K in keyof To | keyof From]: K extends keyof To
		? K extends keyof From
			? To[K] extends object // {} <- ?
				? From[K] extends object
					? Expand<DeepAssign<To[K], From[K]>> // {} <- {}
					: never // {} <- x
				: From[K] extends object
					? never // x <- {}
					: From[K] // x <- x
			: To[K]
		: From[K & keyof From]; // (none) <- ?
};

export function deepAssign<To extends object, From extends object>(
	to: To,
	from: From,
	treatArraysAsPrimitives = false
): DeepAssign<To, From> {
	const keys = new Set<keyof To | keyof From>([
		...(Object.keys(to) as (keyof To)[]),
		...(Object.keys(from) as (keyof From)[]),
	]) as Set<keyof To & keyof From>;

	for (const key of keys) {
		if (!(key in from)) continue;

		const value = from[key] as any;

		if (!(key in to)) {
			to[key] = value;
			continue;
		}

		if (
			(!isObject(to[key]) && Object(value) !== value)
			|| (treatArraysAsPrimitives && Array.isArray(value) && !Array.isArray(to[key]))
		) {
			to[key] = value;
			continue;
		}

		if (isObject(to[key]) && Object(value) === value) {
			deepAssign(to[key], value);
			continue;
		}

		throw new TypeError(
			!isObject(to[key])
				? 'Can not deeply assign an object to a primitive'
				: 'Can not deeply assign a primitive to an object'
		);
	}

	return to as DeepAssign<To, From>;
}

/**
 * Entries of T
 */
export type EntriesTuple<T extends object> = UnionToTuple<{ [K in keyof T]: [K, T[K]] }[keyof T]>
	& [unknown, unknown][];

/**
 * Entries of T
 */
export type Entries<T extends object> = ({ [K in keyof T]: [K, T[K]] }[keyof T] & unknown[])[];

export function isJSON(str: string) {
	try {
		JSON.parse(str);
		return true;
	} catch {
		return false;
	}
}

export function resolveConstructors(object: object): string[] {
	const constructors = [];
	for (
		let prototype = object;
		prototype && !['Function', 'Object'].includes(prototype.constructor.name);
		prototype = Object.getPrototypeOf(prototype)
	) {
		constructors.push(prototype.constructor.name);
	}
	return constructors;
}

export function* getAllPrototypes(object: object): IterableIterator<object> {
	for (let prototype = object; prototype; prototype = Object.getPrototypeOf(prototype)) {
		yield prototype;
	}
}

/**
 * Allows you to convert an object with specific member types into a Map that will give you the correct type for the correct member
 */
export interface ConstMap<T extends Partial<Record<keyof any, any>>, K extends keyof any = keyof T, V = T[keyof T]>
	extends Map<K, V> {
	get<TK extends keyof T>(key: TK): T[TK];
	get(key: K): V;
	set<TK extends keyof T>(key: TK, value: T[TK]): this;
	set(key: K, value: V): this;
	has(key: keyof T | K): boolean;
}

export function map<const T extends Partial<Record<any, any>>>(items: T): Map<keyof T, T[keyof T]> {
	return new Map(Object.entries(items) as [keyof T, T[keyof T]][]);
}

export function getByString<T>(object: Record<string, any>, path: string, separator = /[.[\]'"]/): T {
	return path
		.split(separator)
		.filter(p => p && p != '__proto__')
		.reduce((o, p) => o?.[p], object) as T;
}

export function setByString<T>(object: Record<string, any>, path: string, value: unknown, separator = /[.[\]'"]/): T {
	return path
		.split(separator)
		.filter(p => p && p != '__proto__')
		.reduce(
			(o, p, i) => (o[p] = path.split(separator).filter(p => p).length === ++i ? value : o[p] || {}),
			object
		) as T;
}

export type JSONPrimitive = null | string | number | boolean;

export interface JSONObject {
	[K: string]: JSONValue | undefined;
}

export type JSONValue = JSONPrimitive | JSONObject | JSONValue[];

/**
 * An object `T` with all of its functions bound to a `This` value
 */
export type Bound<T extends object, This = any> = T & {
	[k in keyof T]: T[k] extends (...args: any[]) => any
		? (this: This, ...args: Parameters<T[k]>) => ReturnType<T[k]>
		: T[k];
};

/**
 * Binds a this value for all of the functions in an object (not recursive)
 */
export function bindFunctions<T extends object, This = any>(fns: T, thisValue: This): Bound<T, This> {
	return Object.fromEntries(
		Object.entries(fns).map(([k, v]) => [k, typeof v == 'function' ? v.bind(thisValue) : v])
	) as Bound<T, This>;
}

/**
 * Makes all properties in T mutable
 */
export type Mutable<T> = {
	-readonly [P in keyof T]: T[P];
};

/**
 * Makes all properties in T readonly recursively
 */
export type ReadonlyRecursive<T> = T extends object ? { readonly [K in keyof T]: ReadonlyRecursive<T[K]> } : T;

/**
 * Makes all properties in T mutable recursively
 */
export type MutableRecursive<T> = T extends object ? { -readonly [P in keyof T]: MutableRecursive<T[P]> } : T;

/**
 * Makes properties with keys assignable to K in T required
 * @see https://stackoverflow.com/a/69328045/17637456
 */
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/**
 * Makes properties with keys assignable to K in T optional
 */
export type WithOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type ClassLike<Instance = any> = abstract new (...args: any[]) => Instance;

export type InstancesFor<T extends readonly ClassLike[]> = T extends []
	? []
	: T extends readonly [infer C extends ClassLike, ...infer Rest extends readonly ClassLike[]]
		? [InstanceType<C>, ...InstancesFor<Rest>]
		: never;

export type ConstructorsFor<T extends readonly unknown[]> = T extends []
	? []
	: T extends readonly [infer I, ...infer Rest extends readonly unknown[]]
		? [new (...args: any[]) => I, ...ConstructorsFor<Rest>]
		: never;

export type Concrete<T extends ClassLike> = Pick<T, keyof T> & (new (...args: any[]) => InstanceType<T>);

/**
 * Extracts an object with properties assignable to P from an object T
 * @see https://stackoverflow.com/a/71532723/17637456
 */
export type ExtractProperties<T, P> = {
	[K in keyof T as T[K] extends infer Prop ? (Prop extends P ? K : never) : never]: T[K];
};

/**
 * Extract the keys of T which are required
 * @see https://stackoverflow.com/a/55247867/17637456
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type RequiredKeys<T> = { [K in keyof T]-?: {} extends { [P in K]: T[K] } ? never : K }[keyof T];

/**
 * @see https://dev.to/tmhao2005/ts-useful-advanced-types-3k5e
 */
export type RequiredProperties<T extends object, K extends keyof T = keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * @see https://dev.to/tmhao2005/ts-useful-advanced-types-3k5e
 */
export type DeepRequired<T> = {
	[K in keyof T]-?: DeepRequired<T[K]>;
};

/**
 * @see https://dev.to/tmhao2005/ts-useful-advanced-types-3k5e
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<T>;

/**
 * @see https://dev.to/tmhao2005/ts-useful-advanced-types-3k5e
 */
export type NestedKeys<T extends object> = {
	[P in keyof T & (string | number)]: T[P] extends Date
		? `${P}`
		: T[P] extends Record<string, unknown>
			? `${P}` | `${P}.${NestedKeys<T[P]>}`
			: `${P}`;
}[keyof T & (string | number)];

/**
 * @see https://dev.to/tmhao2005/ts-useful-advanced-types-3k5e
 */
export type PartialRecursive<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? PartialRecursive<U>[]
		: T[P] extends object | undefined
			? PartialRecursive<T[P]>
			: T[P];
};

/**
 * Nothing in T
 */
export type Never<T> = { [K in keyof T]?: never };

/**
 * All of the properties in T or none of them
 */
export type AllOrNone<T> = T | Never<T>;

export type Filter<Key, Arr extends readonly any[]> = Arr extends readonly [infer L, ...infer R]
	? L extends Key
		? Filter<Key, R>
		: [L, ...Filter<Key, R>]
	: [];
