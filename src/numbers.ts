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

const byteSizePattern = /^(?<size>\d+(?:\.\d+)?)\s*(?<unit>\w*)$/i;
const units = ['', 'K', 'M', 'G', 'T', 'P', 'E'];

/**
 * Parse a string containing some number of bytes, e.g. `1 GiB` or `99.4kb`
 */
export function parseBytes(input: string): bigint | null {
	const match = byteSizePattern.exec(input.trim());
	if (!match) return null;
	const size = BigInt(match.groups!.size);
	let unit = match.groups!.unit.toUpperCase();
	if (unit.at(-1) == 'B') unit = unit.slice(0, -1);
	if (unit.at(-1) == 'I') unit = unit.slice(0, -1);
	const unitIndex = BigInt(units.indexOf(unit));
	if (unitIndex === -1n) return null;
	return size * 1024n ** unitIndex;
}
