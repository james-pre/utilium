// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2025 James Prevett

import type { Length, Unshift, Push, FromLength } from './array.js';
import type { Subtract } from './type-math.js';

/**
 * Expands the type T (for intellisense and debugging)
 * @see https://stackoverflow.com/a/69288824/17637456
 */
export type Expand<T> = T extends (...args: infer A) => infer R
	? (...args: Expand<A>) => Expand<R>
	: T extends infer O
		? { [K in keyof O]: O[K] }
		: never;

/**
 * Recursivly expands the type T (for intellisense and debugging)
 * @see https://stackoverflow.com/a/69288824/17637456
 */
export type ExpandRecursively<T> = T extends (...args: infer A) => infer R
	? (...args: ExpandRecursively<A>) => ExpandRecursively<R>
	: T extends object
		? T extends infer O
			? { [K in keyof O]: ExpandRecursively<O[K]> }
			: never
		: T;

/**
 * Get the keys of a union of objects
 * @see https://stackoverflow.com/a/65805753/17637456
 */
export type UnionKeys<T> = T extends T ? keyof T : never;

type StrictUnionHelper<T, TAll> = T extends unknown
	? T & Partial<Record<Exclude<UnionKeys<TAll>, keyof T>, never>>
	: never;

/**
 * @see https://stackoverflow.com/a/65805753/17637456
 */
export type StrictUnion<T> = Expand<StrictUnionHelper<T, T>>;

// compile-time math

/**
 * Increments N
 * @deprecated Use Add<N, 1> instead
 */
export type Increment<N extends number> = Length<Unshift<FromLength<N>, 0>>;

/**
 * Decrements N
 * @deprecated Use Subtract<N, 1> instead
 */
export type Decrement<N extends number> = Subtract<N, 1>;

/**
 * Keys of a Map
 */
export type MapKeys<T> = T extends Map<infer K, any> ? K : never;

/**
 * Converts a union to an intersection
 * @see https://stackoverflow.com/a/55128956/17637456
 */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/**
 * Gets the last element of a union
 * @see https://stackoverflow.com/a/55128956/17637456
 */
export type LastOfUnion<T> = UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never;

/**
 * Converts a union to a tuple
 * @see https://stackoverflow.com/a/55128956/17637456
 */
export type UnionToTuple<T, L = LastOfUnion<T>, N = [T] extends [never] ? true : false> = true extends N
	? []
	: Push<UnionToTuple<Exclude<T, L>>, L>;

/**
 * Utility to reduce depth of TypeScript's internal type instantiation stack.
 * Some wizard on the Kysely team came up with this.
 * It improves performance for the math types by an order of magnitude.
 */
export type $drain<T> = [T] extends [unknown] ? T : never;
