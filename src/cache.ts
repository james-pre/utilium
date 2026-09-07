// SPDX-License-Identifier: LGPL-3.0-or-later
/**
 * A ranged cache
 * Copyright (c) 2025 James Prevett
 */
export interface Options {
	/**
	 * If true, use multiple buffers to cache a file.
	 * This is useful when working with small parts of large files,
	 * since we don't need to allocate a large buffer that is mostly unused
	 * @default true
	 */
	sparse?: boolean;

	/**
	 * The threshold for whether to combine regions or not
	 * @see Region
	 * @default 0xfff // 4 KiB
	 */
	regionGapThreshold?: number;

	/**
	 * Whether to only update the cache when changing or deleting resources
	 * @default false
	 */
	cacheOnly?: boolean;

	/**
	 * Multiplier applied to a region's capacity when it has to grow.
	 * Values outside `[1, 100]` fall back to the default.
	 * Higher trades memory for fewer reallocations, while `1` allocates exactly what is needed and makes repeated appends quadratic.
	 * @default 2
	 */
	growFactor?: number;
}

export type Range = { start: number; end: number };

/** Insert `[start, end)` into a sorted, non-overlapping list of ranges, merging it with any ranges it touches. */
export function addRange(ranges: Range[], start: number, end: number): void {
	let i = ranges.length;
	while (i > 0 && ranges[i - 1].start > start) i--;

	const prev = ranges[i - 1];
	if (prev && prev.end >= start) {
		if (prev.end >= end) return;
		prev.end = end;
	} else {
		ranges.splice(i, 0, { start, end });
		i++;
	}

	const merged = ranges[i - 1];
	let j = i;
	while (j < ranges.length && ranges[j].start <= merged.end) {
		merged.end = Math.max(merged.end, ranges[j].end);
		j++;
	}
	if (j > i) ranges.splice(i, j - i);
}

export interface Region {
	/** The region's offset from the start of the resource */
	offset: number;

	/** Ranges cached in this region. These are absolute! */
	ranges: Range[];

	/** Data for this region */
	data: Uint8Array;
}

/**
 * The cache for a specific resource
 * @internal
 */
export class Resource<ID> {
	/** Regions used to reduce unneeded allocations. Think of sparse arrays. */
	public readonly regions: Region[] = [];

	/** The full size of the resource */
	public get size() {
		return this._size;
	}

	public set size(value: number) {
		if (value >= this._size) {
			this._size = value;
			return;
		}

		this._size = value;

		for (let i = this.regions.length - 1; i >= 0; i--) {
			const region = this.regions[i];

			if (region.offset >= value) {
				this.regions.splice(i, 1);
				continue;
			}

			const maxLength = value - region.offset;
			if (region.data.byteLength > maxLength) {
				region.data = region.data.subarray(0, maxLength);
			}

			region.ranges = region.ranges
				.filter(range => range.start < value)
				.map(range => {
					if (range.end > value) {
						return { start: range.start, end: value };
					}
					return range;
				});
		}
	}

	public constructor(
		/** The resource ID */
		public readonly id: ID,
		protected _size: number,
		protected readonly options: Options,
		resources?: Map<ID, Resource<ID> | undefined>
	) {
		options.sparse ??= true;
		if (
			!options.growFactor
			|| !Number.isFinite(options.growFactor)
			|| options.growFactor < 1
			|| options.growFactor > 100
		)
			options.growFactor = 2;
		if (!options.sparse) this.regions.push({ offset: 0, data: new Uint8Array(_size), ranges: [] });

		resources?.set(id, this);
	}

	/**
	 * Resize `region.data` to `length` bytes.
	 * Capacity can be over-allocated geometrically so appending to a region repeatedly stays amortized O(1).
	 */
	protected resizeRegion(region: Region, length: number): void {
		const { buffer, byteOffset } = region.data;

		if (buffer.byteLength - byteOffset >= length) {
			region.data = new Uint8Array(buffer, byteOffset, length);
			return;
		}

		const grown = new Uint8Array(Math.max(length, (buffer.byteLength - byteOffset) * this.options.growFactor!));
		grown.set(region.data);
		region.data = grown.subarray(0, length);
	}

	/** Merge the region after `index` into the one at `index`, if the gap between them is small enough */
	protected mergeAt(index: number): boolean {
		const current = this.regions[index];
		const next = this.regions[index + 1];
		if (!current || !next) return false;

		const { regionGapThreshold = 0xfff } = this.options;
		if (next.offset - (current.offset + current.data.byteLength) > regionGapThreshold) return false;

		for (const range of next.ranges) addRange(current.ranges, range.start, range.end);

		const length = next.offset + next.data.byteLength - current.offset;
		if (length > current.data.byteLength) this.resizeRegion(current, length);
		current.data.set(next.data, next.offset - current.offset);

		this.regions.splice(index + 1, 1);
		return true;
	}

	/** Combines adjacent regions and combines adjacent ranges within a region */
	public collect(): void {
		if (!this.options.sparse) return;
		for (let i = 0; i < this.regions.length - 1;) if (!this.mergeAt(i)) i++;
	}

	/**
	 * Combine the region at `index` with the neighbors it now reaches.
	 * Only that region can have changed, so this does not re-walk the whole list the way `collect` does.
	 */
	protected collectAt(index: number): void {
		if (!this.options.sparse) return;
		if (index > 0 && this.mergeAt(index - 1)) index--;
		while (this.mergeAt(index));
	}

	/** Takes an initial range and finds the sub-ranges that are not in the cache */
	public missing(start: number, end: number): Range[] {
		const missingRanges: Range[] = [];

		for (const region of this.regionsIn(start, end)) {
			for (const range of region.ranges) {
				if (range.end <= start) continue;
				if (range.start >= end) break;

				if (range.start > start) {
					missingRanges.push({ start, end: Math.min(range.start, end) });
				}

				// Adjust the current start if the region overlaps
				if (range.end > start) start = Math.max(start, range.end);

				if (start >= end) break;
			}

			if (start >= end) break;
		}

		// If there are still missing parts at the end
		if (start < end) missingRanges.push({ start, end });

		return missingRanges;
	}

	/**
	 * Get the cached sub-ranges of an initial range.
	 * This is conceptually the inverse of `missing`.
	 */
	public cached(start: number, end: number): Range[] {
		const cachedRanges: Range[] = [];

		for (const region of this.regionsIn(start, end)) {
			for (const range of region.ranges) {
				if (range.end <= start) continue;
				if (range.start >= end) break;

				cachedRanges.push({
					start: Math.max(start, range.start),
					end: Math.min(end, range.end),
				});
			}
		}

		cachedRanges.sort((a, b) => a.start - b.start);
		const merged: Range[] = [];
		for (const curr of cachedRanges) {
			const last = merged.at(-1);
			if (last && curr.start <= last.end) {
				last.end = Math.max(last.end, curr.end);
			} else {
				merged.push(curr);
			}
		}

		return merged;
	}

	/** Index of the first region positioned after `offset`. Regions are kept sorted, so this is a binary search. */
	protected indexAfter(offset: number): number {
		let low = 0,
			high = this.regions.length;

		while (low < high) {
			const mid = (low + high) >> 1;
			if (this.regions[mid].offset > offset) high = mid;
			else low = mid + 1;
		}

		return low;
	}

	/** Get the region who's ranges include an offset */
	public regionAt(offset: number): Region | undefined {
		const region = this.regions[this.indexAfter(offset) - 1];
		if (region && offset < region.offset + region.data.byteLength) return region;
	}

	/** The regions overlapping `[start, end)`, in order. Seeks to the first one rather than scanning from the start. */
	public *regionsIn(start: number, end: number): Generator<Region> {
		for (let i = Math.max(0, this.indexAfter(start) - 1); i < this.regions.length; i++) {
			const region = this.regions[i];
			if (region.offset >= end) return;
			if (region.offset + region.data.byteLength > start) yield region;
		}
	}

	/** Add new data to the cache at given specified offset */
	public add(data: Uint8Array, offset: number): this {
		const end = offset + data.byteLength;
		const index = this.indexAfter(offset) - 1;
		const region = this.regions[index];

		if (region && offset < region.offset + region.data.byteLength) {
			// `region.data` holds bytes starting at `region.offset`, so positions
			// within it are relative to `region.offset` (not absolute resource offsets).
			if (end - region.offset > region.data.byteLength) this.resizeRegion(region, end - region.offset);
			region.data.set(data, offset - region.offset);
			addRange(region.ranges, offset, end);

			this.collectAt(index);
			return this;
		}

		// Insert at the right index to keep regions sorted
		this.regions.splice(index + 1, 0, { data, offset, ranges: [{ start: offset, end }] });

		this.collectAt(index + 1);
		return this;
	}
}
