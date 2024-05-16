export function capitalize<T extends string>(value: T): Capitalize<T> {
	return <Capitalize<T>>(value.at(0)!.toUpperCase() + value.slice(1));
}

export function uncapitalize<T extends string>(value: T): Uncapitalize<T> {
	return <Uncapitalize<T>>(value.at(0)!.toLowerCase() + value.slice(1));
}

export type ConcatString<T extends string[]> = T extends [infer F extends string, ...infer R extends string[]] ? `${F}${ConcatString<R>}` : '';

export type Join<T extends string[], S extends string = ','> = T extends [infer F extends string, ...infer R extends string[]]
	? `${F}${R extends [] ? '' : `${S}${Join<R, S>}`}`
	: '';

export type Whitespace = ' ' | '\t';

export type Trim<T extends string> = T extends `${Whitespace}${infer R extends string}` ? Trim<R> : T;
