// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2025 James Prevett

import { resolveConstructors } from './objects.js';

export function wait(time: number) {
	return new Promise(resolve => setTimeout(resolve, time));
}

export const greekLetterNames = [
	'Alpha',
	'Beta',
	'Gamma',
	'Delta',
	'Epsilon',
	'Zeta',
	'Eta',
	'Theta',
	'Iota',
	'Kappa',
	'Lambda',
	'Mu',
	'Nu',
	'Xi',
	'Omicron',
	'Pi',
	'Rho',
	'Sigma',
	'Tau',
	'Upsilon',
	'Phi',
	'Chi',
	'Psi',
	'Omega',
];

const hexRegex = /^[0-9a-f-.]+$/;

export function isHex(str: string) {
	return hexRegex.test(str);
}

/** Prevent infinite loops */
export function canary(error: Error = new Error()) {
	const timeout = setTimeout(() => {
		throw error;
	}, 5000);

	return () => clearTimeout(timeout);
}

/**
 * A wrapper for throwing things in an expression context.
 * You will likely want to remove this if you can just use `throw` in expressions.
 * @see https://github.com/tc39/proposal-throw-expressions
 */
export function _throw(e: unknown): never {
	if (e && typeof e == 'object' && resolveConstructors(e).includes('Error')) Error?.captureStackTrace(e, _throw);
	throw e;
}

export function memoize<T, This extends object>(get: () => T, context: ClassGetterDecoratorContext<This, T>): () => T;
export function memoize<T, This extends object>(
	value: { get(): T; set(value: T): void },
	context: ClassAccessorDecoratorContext<This, T>
): { get(): T; set(value: T): void };
export function memoize<T, This extends object>(
	value: (() => T) | { get(): T; set(value: T): void },
	context: ClassGetterDecoratorContext<This, T> | ClassAccessorDecoratorContext<This, T>
) {
	if (!['getter', 'accessor'].includes(context.kind))
		throw new Error('@memoize can only be used on getters and auto-accessors');

	const cache = new WeakMap<This, T>();

	function get(this: This): T {
		if (cache.has(this)) return cache.get(this)!;
		const result = typeof value === 'function' ? value.call(this) : value.get.call(this);
		cache.set(this, result);
		return result;
	}

	switch (context.kind) {
		case 'getter':
			return get;
		case 'accessor':
			return { ...value, get };
	}
}
