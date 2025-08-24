// SPDX-License-Identifier: LGPL-3.0-or-later
/**
 * Type-system arithmetic.
 * Copyright (c) 2025 James Prevett
 *
 * Notes on implementation:
 *
 * Snake case is used for internal types to reduce visual conflict/confusion with type variables.
 * Type naming convention:
 * `w_*` => internals that operate on whole numbers (i.e. n >= 0)
 * `i_*` => internals that operate on integers
 * `_*`  => general purpose internals
 *
 */

import type { PadRight, Repeat, StringLength } from './string.js';
import type { $drain, Length } from './types.js';

/**
 * Maps a numeric literal type to a tuple type with that length
 */
type __tuple<L extends number, T extends any[] = []> = $drain<T extends { length: L } ? T : __tuple<L, [...T, any]>>;

/**
 * Sum A and B (both must be whole numbers)
 */
type w_add<A extends number, B extends number> = Length<[...__tuple<A>, ...__tuple<B>]>;

/**
 * Subtracts B from A (both must be whole numbers)
 */
type w_subtract<A extends number, B extends number> =
	__tuple<A> extends [...infer U, ...__tuple<B>] ? Length<U> : never;

/**
 * Is A strictly equal to B?
 */
export type Equal<A, B> = A extends B ? (B extends A ? true : false) : false;

/**
 * Is A or B zero?
 */
type _either_zero<A extends number, B extends number> = A extends 0 ? true : B extends 0 ? true : false;

/**
 * Is A less than B? (whole numbers)
 */
type w_less<A extends number, B extends number> = $drain<
	_either_zero<A, B> extends true
		? Equal<A, B> extends true
			? false
			: A extends 0
				? true
				: false
		: w_less<w_subtract<A, 1>, w_subtract<B, 1>>
>;

/**
 * Negate *any* number.
 */
export type Negate<N extends number> = N extends 0
	? 0
	: `-${N}` extends `${infer V extends number}`
		? V
		: `${N}` extends `-${infer V extends number}`
			? V
			: never;

export type Absolute<N extends number> = N extends 0 ? 0 : `${N}` extends `-${infer V extends number}` ? V : N;

export type Is_Negative<N extends number> = `${N}` extends `-${number}` ? true : false;
export type Is_Positive<N extends number> = `-${N}` extends `${number}` ? true : false;

type _is_int<N extends number> = `${N}` extends `${number}.${number}` ? false : true;

type _are_ints<A extends number, B extends number> =
	_is_int<A> extends true ? (_is_int<B> extends true ? true : false) : false;

/**
 * Sum integers A and B.
 *
 * Does not perform integer validation!
 * @internal
 */
type i_sum<A extends number, B extends number> = `${A}` extends `-${infer A_abs extends number}`
	? `${B}` extends `-${infer B_abs extends number}`
		? // A < 0, B < 0
			Negate<w_add<A_abs, B_abs>>
		: w_less<A_abs, B> extends true
			? // A < 0, B >= 0, |A| < B
				w_subtract<B, A_abs>
			: // A < 0, B >= 0, |A| >= B
				Negate<w_subtract<A_abs, B>>
	: `${B}` extends `-${infer B_abs extends number}`
		? w_less<A, B_abs> extends true
			? // A >= 0, B < 0, A < |B|
				Negate<w_subtract<B_abs, A>>
			: // A >= 0, B < 0, A >= |B|
				w_subtract<A, B_abs>
		: // A >= 0, B >= 0
			w_add<A, B>;

/**
 * Add integers A and B.
 * @internal
 */
export type $Add<A extends number, B extends number> = _are_ints<A, B> extends true ? i_sum<A, B> : never;

/**
 * Subtract integer B from A.
 * @internal
 */
export type $Subtract<A extends number, B extends number> = _are_ints<A, B> extends true ? i_sum<A, Negate<B>> : never;

/**
 * Accumulative addition:
 * N: increment
 * I: iterations (>= 0)
 * A: sum
 */
type _i_mul_accumulate<N extends number, I extends number, A extends number> = $drain<
	I extends 0 ? A : _i_mul_accumulate<N, i_sum<I, -1>, i_sum<N, A>>
>;

/**
 * Integer multiplication
 */
type i_multiply<A extends number, B extends number> = `${B}` extends `-${infer B_abs extends number}`
	? Negate<_i_mul_accumulate<A, B_abs, 0>>
	: _i_mul_accumulate<A, B, 0>;

/**
 * Is A less than B?
 * @internal
 */
type i_less<A extends number, B extends number> = $drain<
	_either_zero<A, B> extends true
		? Equal<A, B> extends true
			? false
			: A extends 0
				? true
				: false
		: i_less<i_sum<A, -1>, i_sum<B, -1>>
>;

export type $LessThan<A extends number, B extends number> = _are_ints<A, B> extends true ? i_less<A, B> : never;

type i_max<A extends number, B extends number> = i_less<A, B> extends true ? B : A;

export type $Max<A extends number, B extends number> = _are_ints<A, B> extends true ? i_max<A, B> : never;

/**
 * Accumulative subtraction:
 * N: initial value
 * D: divisor
 * Q: quotient
 */
type w_divide<N extends number, D extends number, Q extends number> = $drain<
	D extends 0 ? never : i_less<N, D> extends true ? Q : w_divide<i_sum<N, Negate<D>>, D, i_sum<Q, 1>>
>;

/**
 * Integer division
 */
type i_divide<A extends number, B extends number> = `${A}` extends `-${infer A_abs extends number}`
	? `${B}` extends `-${infer B_abs extends number}`
		? w_divide<A_abs, B_abs, 0>
		: Negate<w_divide<A_abs, B, 0>>
	: `${B}` extends `-${infer B_abs extends number}`
		? Negate<w_divide<A, B_abs, 0>>
		: w_divide<A, B, 0>;

/**
 * Integer multiplication
 */
export type Multiply<A extends number, B extends number> = _are_ints<A, B> extends true ? i_multiply<A, B> : never;

/**
 * Integer division
 */
export type Divide<A extends number, B extends number> = _are_ints<A, B> extends true ? i_divide<A, B> : never;

/**
 * Modulo
 */
export type Modulo<A extends number, B extends number> =
	_are_ints<A, B> extends true ? (i_less<A, B> extends true ? A : Modulo<i_sum<A, Negate<B>>, B>) : never;

/**
 * Get the integer part of a number
 */
export type Integer<N extends number> = `${N}` extends `${infer I extends number}.${string}` ? I : N;

/**
 * Get the fractional part of a number
 */
export type Fraction<N extends number> = `${N}` extends `${number}.${infer S extends string}`
	? `0.${S}` extends `${infer F extends number}`
		? F
		: never
	: 0;

type _f_padding_needed<A extends string, B extends string> =
	i_sum<StringLength<A>, Negate<StringLength<B>>> extends 0 ? 0 : i_max<StringLength<A>, StringLength<B>>;

type _f_sum_str<A_s extends string, B_s extends string> =
	Repeat<'0', i_max<0, w_subtract<StringLength<B_s>, StringLength<A_s>>>, A_s> extends `${infer A_f extends number}`
		? Repeat<
				'0',
				i_max<0, w_subtract<StringLength<A_s>, StringLength<B_s>>>,
				B_s
			> extends `${infer B_f extends number}`
			? i_sum<A_f, B_f>
			: never
		: never;

/**
 * Sum the fractional parts A and B of two numbers
 */
type f_sum<A extends number, B extends number> = `${A}` extends `0.${infer A_s extends string}`
	? `${B}` extends `0.${infer B_s extends string}`
		? `0.${_f_sum_str<A_s, B_s>}` extends `${infer F extends number}`
			? F
			: never
		: never
	: never;

type _sum_with_f<
	A extends number,
	B extends number,
	F extends number,
> = `${F}` extends `${infer C extends number}.${infer S}`
	? `${i_sum<i_sum<Integer<A>, Integer<B>>, C>}.${S}` extends `${infer V extends number}`
		? V
		: never
	: never;

export type Add<A extends number, B extends number> =
	Fraction<A> extends 0
		? Fraction<B> extends 0
			? i_sum<A, B>
			: _sum_with_f<A, B, Fraction<B>>
		: Fraction<B> extends 0
			? _sum_with_f<A, B, Fraction<A>>
			: _sum_with_f<A, B, f_sum<Fraction<A>, Fraction<B>>>;

export type Subtract<A extends number, B extends number> = Add<A, Negate<B>>;
