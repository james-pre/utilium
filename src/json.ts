import * as fs from 'fs';

export function isJSON(str: string) {
	try {
		JSON.parse(str);
		return true;
	} catch (e) {
		return false;
	}
}

export type JSONObject<Key extends string | number | symbol = string> = { [K in Key]: JSONValue };

export type JSONValue<Key extends string | number | symbol = string> = string | number | boolean | JSONObject<Key> | Array<JSONValue>;

interface FileMapOptions {
	overwrite_invalid_json: boolean;
}

/**
 * A Map overlaying a JSON file
 */
export class FileMap<T extends JSONValue = JSONValue> implements Map<string, T> {
	get [Symbol.toStringTag](): 'JSONFileMap' {
		return 'JSONFileMap';
	}

	constructor(
		public readonly path: string,
		public readonly options: FileMapOptions
	) {
		if (!fs.existsSync(path)) {
			fs.writeFileSync(path, '{}');
		}
	}

	get _map(): Map<string, T> {
		const content = fs.readFileSync(this.path, 'utf8');
		if (!isJSON(content)) {
			if (!this.options.overwrite_invalid_json) {
				throw new SyntaxError(`Invalid JSON file: ${this.path}`);
			}
			console.warn(`Invalid JSON file: ${this.path} (overwriting)`);
			this.clear();
			return new Map();
		}
		return new Map(Object.entries(JSON.parse(content)));
	}

	_write(map: Map<string, T>) {
		if (!fs.existsSync(this.path)) {
			fs.writeFileSync(this.path, '{}');
		}
		const content = JSON.stringify(Object.fromEntries(map));
		fs.writeFileSync(this.path, content);
	}

	clear() {
		fs.writeFileSync(this.path, '{}');
	}

	delete(key: string): boolean {
		const map = this._map;
		const rt = map.delete(key);
		this._write(map);
		return rt;
	}

	get<U extends T>(key: string): U {
		return this._map.get(key) as U;
	}

	has(key: string): boolean {
		return this._map.has(key);
	}

	set(key: string, value: T): this {
		const map = this._map;
		map.set(key, value);
		this._write(map);
		return this;
	}

	get size() {
		return this._map.size;
	}

	get [Symbol.iterator]() {
		return this._map[Symbol.iterator].bind(this._map);
	}

	get keys(): typeof this._map.keys {
		return this._map.keys.bind(this._map);
	}

	get values(): typeof this._map.values {
		return this._map.values.bind(this._map);
	}

	get entries(): typeof this._map.entries {
		return this._map.entries.bind(this._map);
	}

	get forEach(): typeof this._map.forEach {
		return this._map.forEach.bind(this._map);
	}
}

/**
 * A Map overlaying a folder
 */
export class FolderMap implements Map<string, string> {
	get [Symbol.toStringTag](): 'FolderMap' {
		return 'FolderMap';
	}

	constructor(
		protected _path: string,
		protected _suffix = ''
	) {}

	get _names(): string[] {
		return fs
			.readdirSync(this._path)
			.filter(p => p.endsWith(this._suffix))
			.map(p => p.slice(0, -this._suffix.length));
	}

	_join(path: string): string {
		return `${this._path}/${path}${this._suffix}`;
	}

	get _map(): Map<string, string> {
		const entries = [];
		for (const name of this._names) {
			const content = fs.readFileSync(this._join(name), 'utf8');
			entries.push([name, content]);
		}
		return new Map(entries);
	}

	clear(): void {
		for (const name of this._names) {
			fs.unlinkSync(this._join(name));
		}
	}

	delete(key: string): boolean {
		if (!this.has(key)) {
			return false;
		}

		fs.unlinkSync(this._join(key));
		return true;
	}

	get(key: string): string {
		if (this.has(key)) {
			return fs.readFileSync(this._join(key), 'utf8');
		}
	}

	has(key: string): boolean {
		return this._names.includes(key);
	}

	set(key: string, value: string): this {
		fs.writeFileSync(this._join(key), value);
		return this;
	}

	get size() {
		return this._names.length;
	}

	get [Symbol.iterator]() {
		return this._map[Symbol.iterator].bind(this._map);
	}

	get keys() {
		return this._map.keys.bind(this._map);
	}

	get values() {
		return this._map.values.bind(this._map);
	}

	get entries() {
		return this._map.entries.bind(this._map);
	}

	get forEach() {
		return this._map.forEach.bind(this._map);
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

export function toDegrees(radians: number): number {
	return (radians * 180) / Math.PI;
}

export function toRadians(degrees: number): number {
	return (degrees / 180) * Math.PI;
}

/**
 * Gets a random int, r, with the probability P(r) = (base)**r
 * For example, with a probability of 1/2: P(1) = 1/2, P(2) = 1/4, etc.
 * @param probability the probability
 */
export function getRandomIntWithRecursiveProbability(probability = 0.5): number {
	return -Math.floor(Math.log(Math.random()) / Math.log(1 / probability));
}
