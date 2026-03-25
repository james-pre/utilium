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

const missing = Symbol('not memoized');

/**
 * Decorator for memoizing the result of a getter.
 */
export function memoize<T, This>(get: () => T, context: ClassGetterDecoratorContext<This, T>) {
	if (context.kind != 'getter') throw new Error('@memoize can only be used on getters');

	let value: T | typeof missing = missing;
	return function (this: This): T {
		if (value !== missing) {
			return value;
		}
		value = get.call(this);
		return value;
	};
}
