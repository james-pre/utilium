import { EventEmitter } from 'eventemitter3';

export class List<T> extends EventEmitter<'update'> implements RelativeIndexable<T> {
	public readonly [Symbol.toStringTag] = 'List';

	public constructor(values?: readonly T[] | Iterable<T> | null) {
		super();
		if (values) {
			this.push(...values);
		}
	}

	protected data = new Set<T>();

	public toSet(): Set<T> {
		return new Set(this.data);
	}

	public toArray(): T[] {
		return Array.from(this.data);
	}

	public toJSON() {
		return JSON.stringify(Array.from(this.data));
	}

	public toString() {
		return this.join(',');
	}

	public set(index: number, value: T): void {
		if (Math.abs(index) > this.data.size) {
			throw new ReferenceError('Can not set an element outside the bounds of the list');
		}

		const data = Array.from(this.data);
		data.splice(index, 1, value);
		this.data = new Set<T>(data);
		this.emit('update');
	}

	public deleteAt(index: number): void {
		if (Math.abs(index) > this.data.size) {
			throw new ReferenceError('Can not delete an element outside the bounds of the list');
		}

		this.delete(Array.from(this.data).at(index)!);
	}

	// Array methods

	public at(index: number): T {
		if (Math.abs(index) > this.data.size) {
			throw new ReferenceError('Can not access an element outside the bounds of the list');
		}

		return Array.from(this.data).at(index)!;
	}

	public pop(): T | undefined {
		const item = Array.from(this.data).pop();
		if (item !== undefined) {
			this.delete(item);
		}
		return item;
	}

	public push(...items: T[]): number {
		for (const item of items) {
			this.add(item);
		}
		return this.data.size;
	}

	public join(separator?: string): string {
		return Array.from(this.data).join(separator);
	}

	public splice(start: number, deleteCount: number, ...items: T[]): T[] {
		if (Math.abs(start) > this.data.size) {
			throw new ReferenceError('Can not splice elements outside the bounds of the list');
		}

		const data = Array.from(this.data);
		const deleted = data.splice(start, deleteCount, ...items);
		this.data = new Set<T>(data);
		this.emit('update');
		return deleted;
	}

	// Set methods

	public add(value: T): this {
		this.data.add(value);
		this.emit('update');
		return this;
	}

	public clear(): void {
		this.data.clear();
		this.emit('update');
	}

	public delete(value: T): boolean {
		const success = this.data.delete(value);
		this.emit('update');
		return success;
	}

	public has(value: T): boolean {
		return this.data.has(value);
	}

	public get size(): number {
		return this.data.size;
	}

	public entries(): IterableIterator<[T, T]> {
		return this.data.entries();
	}

	public keys(): IterableIterator<T> {
		return this.data.keys();
	}

	public values(): IterableIterator<T> {
		return this.data.values();
	}

	public [Symbol.iterator](): IterableIterator<T> {
		return this.data[Symbol.iterator]();
	}
}
