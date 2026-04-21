// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2025 James Prevett

import type { CoercibleToString } from './string.js';

export function range(min: number, max: number): number[] {
	const a = [];
	for (let i = min; i < max; i++) {
		a.push(i);
	}
	return a;
}

export function toDegrees(radians: number): number {
	return (radians * 180) / Math.PI;
}

export function toRadians(degrees: number): number {
	return (degrees / 180) * Math.PI;
}

const __formatter = Intl.NumberFormat('en', { notation: 'compact' });

export const formatCompact = __formatter.format.bind(__formatter);

export type ToNumber<T extends CoercibleToString> = `${T}` extends `${infer U extends number}` ? U : never;

export type ToBigInt<T extends CoercibleToString> = `${T}` extends `${infer U extends bigint}` ? U : never;
