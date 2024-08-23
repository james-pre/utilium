import { UnionToTuple } from './types.js';

export function filterObject<O extends object, R extends object>(object: O, predicate: (key: keyof O, value: O[keyof O]) => boolean): R {
	const entries = <[keyof O, O[keyof O]][]>Object.entries(object);
	return <R>Object.fromEntries(entries.filter(([key, value]) => predicate(key, value)));
}

export function pick<T extends object, K extends keyof T>(object: T, ...keys: readonly K[]): Pick<T, K>;
export function pick<T extends object, K extends keyof T>(object: T, ...keys: readonly (readonly K[])[]): Pick<T, K>;
export function pick<T extends object, K extends keyof T>(object: T, ...keys: readonly K[] | readonly (readonly K[])[]): Pick<T, K> {
	const picked = <Pick<T, K>>{};
	for (const key of keys.flat() as K[]) {
		picked[key] = object[key];
	}
	return picked;
}

export function omit<T extends object, K extends keyof T>(object: T, ...keys: readonly K[]): Omit<T, K>;
export function omit<T extends object, K extends keyof T>(object: T, ...keys: readonly (readonly K[])[]): Omit<T, K>;
export function omit<T extends object, K extends keyof T>(object: T, ...keys: readonly K[] | readonly (readonly K[])[]): Omit<T, K> {
	return filterObject<T, Omit<T, K>>(object, key => !keys.flat().includes(key as K));
}

export function assignWithDefaults<To extends Record<keyof any, any>, From extends Partial<To>>(to: To, from: From, defaults: Partial<To> = to): void {
	const keys = new Set<keyof To | keyof From>([...Object.keys(to), ...Object.keys(from)]);
	for (const key of keys) {
		try {
			to[key] = from[key] ?? defaults[key] ?? to[key];
		} catch (e) {
			// Do nothing
		}
	}
}

/**
 * Entries of T
 */
export type Entries<T extends object> = UnionToTuple<{ [K in keyof T]: [K, T[K]] }[keyof T]>;

export function isJSON(str: string) {
	try {
		JSON.parse(str);
		return true;
	} catch (e) {
		return false;
	}
}

export function resolveConstructors(object: object): string[] {
	const constructors = [];
	let prototype = object;
	while (prototype && !['Function', 'Object'].includes(prototype.constructor.name)) {
		prototype = Object.getPrototypeOf(prototype);
		constructors.push(prototype.constructor.name);
	}
	return constructors;
}

export function map<const T extends Partial<Record<any, any>>>(items: T): Map<keyof T, T[keyof T]> {
	return new Map(Object.entries(items) as [keyof T, T[keyof T]][]);
}