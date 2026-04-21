/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import type { CoercibleToString } from './string.js';
import type { Subtract, SubtractBigInt } from './type-math.js';
import type { ExpandRecursively, Falsy, UnionToTuple } from './types.js';

/** @internal @hidden */
export interface _EQ {
	result: 'equal';
}

/** @internal @hidden */
export interface _NEQ {
	result: 'not-equal';
}

interface GenericResult {
	type?: string;
	result: string;
}

/** @internal @hidden */
export interface _StringUnknownSubstring {
	result: 'substring';
	before: string;
	after: string;
	add: boolean;
}

/** @internal @hidden */
export type _StringUnknown = _StringUnknownSubstring | _EQ | _NEQ;

export type String<From extends string, To extends string> = string extends To
	? _StringUnknown
	: string extends From
		? _StringUnknown
		: To extends From
			? _EQ
			: To extends `${infer Before}${From}${infer After}`
				? { result: 'substring'; before: Before; after: After; add: true }
				: From extends `${infer Before}${To}${infer After}`
					? { result: 'substring'; before: Before; after: After; add: false }
					: { result: 'not-equal' };

export function string<From extends string, To extends string>(from: From, to: To): String<From, To> {
	type RT = String<From, To>;
	const _to = to as string;
	if (from === _to) return { result: 'equal' } as RT;

	const to_at = _to.indexOf(from);
	if (to_at !== -1)
		return {
			result: 'substring',
			before: _to.slice(0, to_at),
			after: _to.slice(to_at + from.length),
			add: true,
		} as RT;

	const from_at = from.indexOf(_to);
	if (from_at !== -1)
		return {
			result: 'substring',
			before: from.slice(0, from_at),
			after: from.slice(from_at + _to.length),
			add: false,
		} as RT;

	return { result: 'not-equal' } as RT;
}

/** @internal @hidden */
export interface _NumberUnknownDiff {
	type: 'number';
	result: 'diff';
	value: number;
}

/** @internal @hidden */
export type _NumberUnknown = _NumberUnknownDiff | (_NEQ & { type: 'number' });

/**
 * Diff two numbers.
 * `not-equal` is only returned when encountering `NaN` or infinite values
 */
export type Number<From extends number, To extends number> = number extends To
	? _NumberUnknown
	: number extends From
		? _NumberUnknown
		: To extends From
			? _EQ & { type: 'number' }
			: { result: 'diff'; type: 'number'; value: Subtract<To, From> };

export function number<From extends number, To extends number>(from: From, to: To): Number<From, To> {
	type RT = Number<From, To>;
	const _to = to as number;

	if (Number.isNaN(to) || Number.isNaN(from)) {
		return { type: 'number', result: 'not-equal' } as RT;
	}

	if (!Number.isFinite(to) || !Number.isFinite(from)) {
		return { type: 'number', result: _to === from ? 'equal' : 'not-equal' } as RT;
	}

	if (_to === from) return { type: 'number', result: 'equal' } as RT;

	return { type: 'number', result: 'diff', value: from - to } as RT;
}

/** @internal @hidden */
export interface _BigIntUnknown {
	type: 'bigint';
	result: 'diff';
	value: bigint;
}

export type BigInt<From extends bigint, To extends bigint> = bigint extends From
	? _BigIntUnknown
	: bigint extends To
		? _BigIntUnknown
		: From extends To
			? _EQ & { type: 'bigint' }
			: { type: 'bigint'; result: 'diff'; value: SubtractBigInt<To, From> };

export function bigint<From extends bigint, To extends bigint>(from: From, to: To): BigInt<To, From> {
	type RT = BigInt<To, From>;
	const _to = to as bigint;

	if (_to === from) return { type: 'bigint', result: 'equal' } as RT;

	return { type: 'bigint', result: 'diff', value: from - to } as RT;
}

/** @internal @hidden */
export interface _BooleanUnknown {
	type: 'boolean';
	result: 'equal' | 'not-equal';
}

export type Boolean<From extends boolean, To extends boolean> = boolean extends From
	? _BooleanUnknown
	: boolean extends To
		? _BooleanUnknown
		: { type: 'boolean' } & (From extends To ? _EQ : _NEQ);

export function boolean<From extends boolean, To extends boolean>(from: From, to: To): Boolean<From, To> {
	type RT = Boolean<From, To>;
	return { type: 'boolean', result: !!to === !!from ? 'equal' : 'not-equal' } as RT;
}

type fn = (...args: unknown[]) => unknown;

/** @internal @hidden */
export interface _FunctionUnknownDiff {
	type: 'function';
	result: 'diff';
	return: GenericResult;
	args: _ArrayUnknown;
}

/** @internal @hidden */
type _FunctionUnknown = _FunctionUnknownDiff | (_NEQ & { type: 'function' }) | (_EQ & { type: 'function' });

/** @internal @hidden */
export interface _FunctionType<From extends fn, To extends fn> {
	type: 'function';
	result: 'diff';
	return: Deep<ReturnType<From>, ReturnType<To>>;
	args: Array<Parameters<From>, Parameters<To>>;
}

export type FunctionType<From extends fn, To extends fn> = fn extends From
	? _FunctionUnknown
	: fn extends To
		? _FunctionUnknown
		: From extends To
			? To extends From
				? _EQ & { type: 'function' }
				: _FunctionType<From, To>
			: _FunctionType<From, To>;

/** @internal @hidden */
export interface _FunctionRTArgDiff {
	type: 'function';
	result: 'diff-arg';
	argCount: number;
}

type _FunctionRTUnknown = _FunctionRTArgDiff | (_EQ & { type: 'function' });

export type FunctionRT<From extends fn, To extends fn> = fn extends From
	? _FunctionRTUnknown
	: fn extends To
		? _FunctionRTUnknown
		: Parameters<From>['length'] extends Parameters<To>['length']
			? _EQ & { type: 'function' }
			: {
					type: 'function';
					result: 'diff-arg';
					argCount: Subtract<Parameters<From>['length'], Parameters<To>['length']>;
				};

export function functionRT<From extends fn, To extends fn>(from: From, to: To): FunctionRT<From, To> {
	type RT = FunctionRT<From, To>;

	if (from.length === to.length) {
		return { type: 'function', result: 'equal' } as RT;
	}

	return { type: 'function', result: 'diff-arg', argCount: from.length - to.length } as RT;
}

interface _ArrayUnknownDiff {
	type: 'array';
	result: 'diff';
	elements: number;
	changed: GenericResult[];
}

type _ArrayUnknown = _ArrayUnknownDiff | { type: 'array'; result: 'equal' };

interface _ArrayDiff<From extends ArrayLike<unknown>, To extends ArrayLike<unknown>> {
	type: 'array';
	result: 'diff';
	elements: Subtract<From['length'], To['length']>;
	changed: {
		[K in keyof From & keyof To & number]: Deep<From[K], To[K]>;
	}[keyof From & keyof To & number];
}

export type Array<From extends ArrayLike<unknown>, To extends ArrayLike<unknown>> =
	ArrayLike<unknown> extends From
		? _ArrayUnknown
		: ArrayLike<unknown> extends To
			? _ArrayUnknown
			: number extends From['length']
				? _ArrayUnknown
				: number extends To['length']
					? _ArrayUnknown
					: From['length'] extends To['length']
						? { [K in keyof From & keyof To & number]: Deep<From[K], To[K]>['result'] }[keyof From
								& keyof To
								& number] extends 'equal'
							? { type: 'array'; result: 'equal' }
							: _ArrayDiff<From, To>
						: _ArrayDiff<From, To>;

export function array<From extends ArrayLike<unknown>, To extends ArrayLike<unknown>>(
	from: From,
	to: To
): Array<From, To> {
	const lengthDiff = from.length - to.length,
		changed: GenericResult[] = [];

	let neq = false;
	for (let i = 0; i < Math.min(from.length, to.length); i++) {
		const diff = deep(from[i], to[i]);
		changed.push(diff);
		if (diff.result !== 'equal') neq = true;
	}

	return (
		!neq && !lengthDiff
			? { type: 'array', result: 'equal' }
			: { type: 'array', result: 'diff', elements: lengthDiff, changed }
	) as Array<From, To>;
}

interface _ObjectUnknownDiff {
	type: 'object';
	result: 'diff';
	removed: string[];
	added: string[];
	changed: Record<string, GenericResult>;
}

type _ObjectUnknown = _ObjectUnknownDiff | ({ type: 'object' } & _EQ);

interface _ObjectDiff<From extends object, To extends object> {
	type: 'object';
	result: 'diff';
	removed: Exclude<keyof From, keyof To> extends never ? [] : UnionToTuple<Exclude<keyof From, keyof To>>;
	added: Exclude<keyof To, keyof From> extends never ? [] : UnionToTuple<Exclude<keyof To, keyof From>>;
	changed: { [K in keyof From & keyof To]: Deep<From[K], To[K]> };
}

export type Object<From extends object, To extends object> = object extends From
	? _ObjectUnknown
	: object extends To
		? _ObjectUnknown
		: From extends To
			? To extends From
				? { type: 'object'; result: 'equal' }
				: _ObjectDiff<From, To>
			: _ObjectDiff<From, To>;

export function object<From extends object, To extends object>(from: From, to: To): Object<From, To> {
	const fromKeys = new Set(Object.keys(from) as (keyof From)[]),
		toKeys = new Set(Object.keys(to) as (keyof To)[]);

	const removed = fromKeys.difference(toKeys),
		added = toKeys.difference(fromKeys);

	const changed = Object.create(null);
	let neq = false;

	for (const key of fromKeys.intersection(toKeys)) {
		changed[key] = deep(from[key], to[key]);
		if (changed[key].result !== 'equal') neq = true;
	}

	return (
		neq || removed.size || added.size
			? { type: 'object', result: 'diff', removed: Array.from(removed), added: Array.from(added), changed }
			: { type: 'object', result: 'equal' }
	) as Object<From, To>;
}

interface NotComparable {
	result: 'not-comparable';
}

type DeepCommon<From, To> = unknown extends From
	? GenericResult
	: unknown extends To
		? GenericResult
		: From extends string
			? To extends CoercibleToString
				? String<From, `${To}`> & { type: 'string'; coerced: To extends string ? false : true }
				: NotComparable
			: From extends number
				? To extends number
					? Number<From, To> & { coerced: false }
					: To extends bigint
						? `${To}` extends `${infer V extends number}`
							? Number<From, V> & { coerced: true }
							: never & 'error: bigint -> number'
						: NotComparable
				: From extends bigint
					? To extends bigint
						? BigInt<To, From> & { coerced: false }
						: To extends number
							? `${To}` extends `${infer V extends bigint}`
								? BigInt<From, V> & { coerced: true }
								: never & 'error: number -> bigint'
							: NotComparable
					: From extends boolean
						? To extends boolean | Falsy
							? Boolean<From, To extends boolean ? To : false> & {
									coerced: To extends boolean ? false : true;
								}
							: NotComparable
						: From extends symbol
							? To extends symbol
								? {
										type: 'symbol';
										result: symbol extends To
											? 'equal' | 'not-equal'
											: symbol extends From
												? 'equal' | 'not-equal'
												: To extends From
													? 'equal'
													: 'not-equal';
									}
								: NotComparable
							: From extends undefined
								? To extends undefined | Falsy
									? {
											result: 'equal';
											type: 'undefined';
											coerced: To extends undefined ? false : true;
										}
									: NotComparable
								: From extends null
									? To extends null | Falsy
										? { result: 'equal'; type: 'null'; coerced: To extends null ? false : true }
										: NotComparable
									: From extends ArrayLike<unknown>
										? To extends ArrayLike<unknown>
											? Array<From, To>
											: NotComparable
										: From extends object
											? To extends undefined | null
												? NotComparable
												: To extends object
													? Object<From, To>
													: NotComparable
											: NotComparable;

export type DeepRT<From, To> = From extends fn
	? To extends fn
		? FunctionRT<From, To>
		: NotComparable
	: DeepCommon<From, To>;

export type Deep<From, To> = From extends fn
	? To extends fn
		? FunctionType<From, To>
		: NotComparable
	: DeepCommon<From, To>;

interface GenericDeepResult extends GenericResult {
	coerced?: boolean;
}

export function deep<From, To>(from: From, to: To): ExpandRecursively<DeepRT<From, To>> & GenericDeepResult {
	type RT = ExpandRecursively<DeepRT<From, To>>;

	const rt = (value: GenericDeepResult): RT => value as RT;

	switch (typeof from) {
		case 'string':
			if (['symbol', 'function', 'object'].includes(typeof to)) break;
			return rt({
				type: 'string',
				coerced: typeof to !== 'string',
				...string(from, `${to as CoercibleToString}`),
			});
		case 'number':
			if (typeof to == 'number') return rt({ ...number(from, to), coerced: false });
			if (typeof to == 'bigint') return rt({ ...number(from, Number(to)), coerced: true });
			break;
		case 'bigint':
			if (typeof to == 'bigint') return rt({ ...bigint(from, to), coerced: false });
			if (typeof to == 'number') return rt({ ...bigint(from, BigInt(to)), coerced: true });
			break;
		case 'boolean':
			if (typeof to == 'boolean') return rt({ ...boolean(from, to), coerced: false });
			if (!to) return rt({ ...boolean(from, false), coerced: true });
			break;
		case 'symbol':
			if (typeof to !== 'symbol') break;
			return rt({ type: 'symbol', result: (from as symbol) == to ? 'equal' : 'not-equal' });
		case 'undefined':
			if (to === undefined) return rt({ type: 'undefined', result: 'equal', coerced: false });
			if (!to) return rt({ type: 'undefined', result: 'equal', coerced: true });
			break;
		case 'function':
			if (typeof to !== 'function') break;
			return rt({ ...functionRT(from as fn, to as fn) });
		case 'object':
			if (from === null) {
				if (to === null) return rt({ type: 'null', result: 'equal', coerced: false });
				if (!to) return rt({ type: 'null', result: 'equal', coerced: true });
				break;
			}

			if (typeof to != 'object' || !to) break;

			if (Array.isArray(from)) {
				if (!Array.isArray(to)) break;
				return rt(array(from, to));
			}

			return rt(object(from, to));
	}

	return rt({ result: 'not-comparable' });
}
