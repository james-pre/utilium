import { capitalize } from '../string.js';

type BitsToBytes = {
	'8': 1;
	'16': 2;
	'32': 4;
	'64': 8;
};

export type Size<T extends string> = T extends `${'int' | 'uint' | 'float'}${infer bits}` ? (bits extends keyof BitsToBytes ? BitsToBytes[bits] : never) : never;
export type Type = `${'int' | 'uint'}${8 | 16 | 32 | 64}` | `float${32 | 64}`;
export type Valid = Type | Capitalize<Type> | 'char';

export const types = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'float32', 'float64'] satisfies Type[];

export const valids = [...types, ...types.map(t => capitalize(t)), 'char'] satisfies Valid[];

export const regex = /^(u?int|float)(8|16|32|64)$/i;

export type Normalize<T extends Valid> = T extends 'char' ? 'uint8' : Uncapitalize<T>;

export function normalize<T extends Valid>(type: T): Normalize<T> {
	return (type == 'char' ? 'uint8' : type.toLowerCase()) as Normalize<T>;
}

export function isType(type: { toString(): string }): type is Type {
	return regex.test(type.toString());
}

export function isValid(type: { toString(): string }): type is Valid {
	return type == 'char' || regex.test(type.toString().toLowerCase());
}

export function checkValid(type: { toString(): string }): asserts type is Valid {
	if (!isValid(type)) {
		throw new TypeError('Not a valid primitive type: ' + type);
	}
}
