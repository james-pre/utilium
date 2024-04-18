/**
 * Expands the type T (for intellisense and debugging)
 * @see https://stackoverflow.com/a/69288824/17637456
 */
export type Expand<T> = T extends (...args: infer A) => infer R ? (...args: Expand<A>) => Expand<R> : T extends infer O ? { [K in keyof O]: O[K] } : never;

/**
 * Recursivly expands the type T (for intellisense and debugging)
 * @see https://stackoverflow.com/a/69288824/17637456
 */
export type ExpandRecursively<T> = T extends (...args: infer A) => infer R
	? (...args: ExpandRecursively<A>) => ExpandRecursively<R>
	: T extends object
		? T extends infer O
			? { [K in keyof O]: ExpandRecursively<O[K]> }
			: never
		: T;

/**
 * Extracts an object with properties assignable to P from an object T
 * @see https://stackoverflow.com/a/71532723/17637456
 */
export type ExtractProperties<T, P> = {
	[K in keyof T as T[K] extends infer Prop ? (Prop extends P ? K : never) : never]: T[K];
};

/**
 * Extract the keys of T which are required
 * @see https://stackoverflow.com/a/55247867/17637456
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type RequiredKeys<T> = { [K in keyof T]-?: {} extends { [P in K]: T[K] } ? never : K }[keyof T];

/**
 * @see https://dev.to/tmhao2005/ts-useful-advanced-types-3k5e
 */
export type RequiredProperties<T extends object, K extends keyof T = keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * @see https://dev.to/tmhao2005/ts-useful-advanced-types-3k5e
 */
export type DeepRequired<T> = {
	[K in keyof T]: Required<DeepRequired<T[K]>>;
};

/**
 * @see https://dev.to/tmhao2005/ts-useful-advanced-types-3k5e
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<T>;

/**
 * @see https://dev.to/tmhao2005/ts-useful-advanced-types-3k5e
 */
export type NestedKeys<T extends object> = {
	[P in keyof T & (string | number)]: T[P] extends Date ? `${P}` : T[P] extends Record<string, unknown> ? `${P}` | `${P}.${NestedKeys<T[P]>}` : `${P}`;
}[keyof T & (string | number)];

/**
 * @see https://dev.to/tmhao2005/ts-useful-advanced-types-3k5e
 */
export type PartialRecursive<T> = {
	[P in keyof T]?: T[P] extends (infer U)[] ? PartialRecursive<U>[] : T[P] extends object | undefined ? PartialRecursive<T[P]> : T[P];
};

/**
 * Get the keys of a union of objects
 * @see https://stackoverflow.com/a/65805753/17637456
 */
export type UnionKeys<T> = T extends T ? keyof T : never;

type StrictUnionHelper<T, TAll> = T extends unknown ? T & Partial<Record<Exclude<UnionKeys<TAll>, keyof T>, never>> : never;

/**
 * @see https://stackoverflow.com/a/65805753/17637456
 */
export type StrictUnion<T> = Expand<StrictUnionHelper<T, T>>;
