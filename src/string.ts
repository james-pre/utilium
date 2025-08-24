// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2025 James Prevett

import type { $Max, $Subtract } from './type-math.js';
import type { $drain } from './types.js';

export function capitalize<T extends string>(value: T): Capitalize<T> {
	return (value.at(0)!.toUpperCase() + value.slice(1)) as Capitalize<T>;
}

export function uncapitalize<T extends string>(value: T): Uncapitalize<T> {
	return (value.at(0)!.toLowerCase() + value.slice(1)) as Uncapitalize<T>;
}

export type ConcatString<T extends string[]> = T extends [infer F extends string, ...infer R extends string[]]
	? `${F}${ConcatString<R>}`
	: '';

export type Join<T extends string[], S extends string = ','> = T extends [
	infer F extends string,
	...infer R extends string[],
]
	? `${F}${R extends [] ? '' : `${S}${Join<R, S>}`}`
	: '';

export type Whitespace = ' ' | '\t';

export type Trim<T extends string> = T extends `${Whitespace}${infer R extends string}` ? Trim<R> : T;

const encoder = new TextEncoder();

/**
 * Encodes a UTF-8 string into a buffer
 */
export function encodeUTF8(input: string): Uint8Array<ArrayBuffer> {
	return encoder.encode(input) as Uint8Array<ArrayBuffer>;
}

const decoder = new TextDecoder();

/**
 * Decodes a UTF-8 string from a buffer
 */
export function decodeUTF8(input?: Uint8Array): string {
	if (!input) return '';

	if (input.buffer instanceof ArrayBuffer && !input.buffer.resizable) return decoder.decode(input);

	const buffer = new Uint8Array(input.byteLength);
	buffer.set(input);
	return decoder.decode(buffer);
}

export function encodeASCII(input: string): Uint8Array<ArrayBuffer> {
	const data = new Uint8Array(input.length);
	for (let i = 0; i < input.length; i++) {
		data[i] = input.charCodeAt(i);
	}
	return data;
}

export function decodeASCII(input: Uint8Array): string {
	let output = '';
	for (let i = 0; i < input.length; i++) {
		output += String.fromCharCode(input[i]);
	}
	return output;
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export function decodeUUID(uuid: Uint8Array): UUID {
	const hex = Array.from(uuid)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function encodeUUID(uuid: UUID): Uint8Array<ArrayBuffer> {
	const hex = uuid.replace(/-/g, '');
	const data = new Uint8Array(16);
	for (let i = 0; i < 16; i++) {
		data[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return data;
}

export function stringifyUUID(uuid: bigint): UUID {
	const hex = uuid.toString(16).padStart(32, '0');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function parseUUID(uuid: UUID): bigint {
	return BigInt(`0x${uuid.replace(/-/g, '')}`);
}

/**
 * Split a string.
 */
export type Split<T extends string, Delimiter extends string = ''> = string extends T
	? string[]
	: T extends ''
		? []
		: T extends `${infer Left}${Delimiter}${infer Right}`
			? [Left, ...Split<Right, Delimiter>]
			: [T];

export type StringLength<T extends string> = Split<T>['length'];

export type Repeat<T extends string, N extends number, Init extends string = ''> = $drain<
N extends 0
	? Init
	: Repeat<T, $Subtract<N, StringLength<T>>, `${Init}${T}`>
>;

export type PadRight<Init extends string, R extends string, N extends number> = Repeat<
	R,
	$Max<0, $Subtract<N, StringLength<Init>>>,
	Init
>;

export type PadLeft<Init extends string, R extends string, N extends number> = `${Repeat<
	R,
	$Max<0, $Subtract<N, StringLength<Init>>>
>}${Init}`;
