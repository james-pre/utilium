// Tuple and array types
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Subtract } from './type-math.js';
import type { Expand } from './types.js';

/**
 * Filter an array by the types *not* assignable to `Predicate`
 *
 * @example ```ts
 * type nonempty = FilterOut<['example', 'with', 'empty', ''], ''>; // ['example', 'with', 'empty']
 * ```
 */
export type FilterOut<Arr extends readonly any[], Predicate> = Arr extends readonly [infer Head, ...infer Rest]
	? Head extends Predicate
		? FilterOut<Rest, Predicate>
		: [Head, ...FilterOut<Rest, Predicate>]
	: [];

/**
 * Filter an array by the types assignable to `Predicate`
 *
 * @example ```ts
 * type negatives = Filter<['-1', '2', '-3'], `-${number}`>; // ['-1', '-3']
 * ```
 */
export type Filter<Arr extends readonly any[], Predicate> = Arr extends readonly [infer Head, ...infer Rest]
	? Head extends Predicate
		? [Head, ...Filter<Rest, Predicate>]
		: Filter<Rest, Predicate>
	: [];

export type Some<Arr extends readonly any[], Predicate> = Arr extends readonly [infer Head, ...infer Rest]
	? Head extends Predicate
		? true
		: Some<Rest, Predicate>
	: false;

export type Every<Arr extends readonly any[], Predicate> = Arr extends readonly [infer Head, ...infer Rest]
	? Head extends Predicate
		? Every<Rest, Predicate>
		: false
	: true;

/**
 * Empty
 */
export type Empty = [];

/**
 * Removes the first element of T and shifts
 */
export type Shift<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : never;

/**
 * Gets the first element of T
 */
export type First<T extends unknown[]> = T extends [infer F, ...unknown[]] ? F : never;

/**
 * Inserts V into T at the start of T
 */
export type Unshift<T extends unknown[], V> = [V, ...T];

/**
 * Removes the last element of T
 */
export type Pop<T extends unknown[]> = T extends [...infer _, unknown] ? _ : never;

/**
 * Gets the last element of T
 */
export type Last<T extends unknown[]> = T extends [...unknown[], infer Last] ? Last : never;

/**
 * Appends V to T
 */
export type Push<T extends unknown[], V> = [...T, V];

/**
 * Concatenates A and B
 */
export type Concat<A extends unknown[], B extends unknown[]> = Empty extends B ? A : Concat<Unshift<A, 0>, Shift<B>>;

/**
 * Extracts from A what is not B
 *
 * @remarks
 * It does not remove duplicates (so Remove\<[0, 0, 0], [0, 0]\> yields [0]). This is intended and necessary behavior.
 */
export type Remove<A extends unknown[], B extends unknown[]> = Empty extends B ? A : Remove<Shift<A>, Shift<B>>;

/**
 * The length of T
 */
export type Length<T extends unknown[]> = T extends { length: infer L extends number } ? L : never;

type _FromLength<N extends number, R extends unknown[] = Empty> =
	Length<R> extends N ? R : _FromLength<N, Unshift<R, 0>>;

/**
 * Creates a tuple of length N
 */
export type FromLength<N extends number> = _FromLength<N>;

/**
 * Gets the type of an array's members
 */
export type Member<T, D = null> = D extends 0
	? T
	: T extends (infer U)[]
		? Member<U, D extends number ? Subtract<D, 1> : null>
		: T;

/**
 * Flattens an array
 */
export type FlattenArray<A extends unknown[], D = null> = A extends (infer U)[]
	? Member<Exclude<U, A>, D>[]
	: A extends unknown[]
		? { [K in keyof A]: Member<A[K], D> }
		: A;

/**
 * Whether T is a tuple
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type IsTuple<T> = T extends [] ? false : T extends [infer _Head, ...infer _Rest] ? true : false;

/**
 * Flattens a tuple
 */
export type FlattenTuple<A extends unknown[]> = A extends [infer U, ...infer Rest]
	? U extends unknown[]
		? [...U, ...FlattenTuple<Rest>]
		: [U, ...FlattenTuple<Rest>]
	: [];

/**
 * Flattens an array or tuple
 */
export type Flatten<A extends unknown[]> = IsTuple<A> extends true ? FlattenTuple<A> : FlattenArray<A>;

type _Tuple<T, N extends number, R extends unknown[] = Empty> = R['length'] extends N ? R : _Tuple<T, N, [T, ...R]>;

/**
 * Creates a tuple of T with length N
 */
export type Tuple<T, N extends number> = _Tuple<T, N>;

/**
 * Makes all members of the tuple T optional
 */
export type OptionalTuple<T extends unknown[]> = T extends [infer Head, ...infer Tail]
	? [Head?, ...OptionalTuple<Tail>]
	: T;

/**
 * Converts an array of objects with a common key into a keyed object
 *
 * @example
 * ```ts
 * type ducksArray = [
 * 	{ name: 'Gerald', quacks: 6 },
 * 	{ name: 'Dorthy', quacks: 7 },
 * ];
 *
 * type ducks = FromKeyedArray<ducksArray, 'name'>; // { Gerald: { name: 'Gerald', quacks: 6 }, Dorthy: { name: 'Dorthy', quacks: 7 } }
 * ```
 */
export type FromKeyed<
	A extends any[],
	KeyName extends A extends (infer E)[] ? keyof E : never,
> = A extends (infer Element)[]
	? {
			[K in Element[KeyName] & PropertyKey]: Expand<Element & { [_ in KeyName & PropertyKey]: K }>;
		}
	: never;
