/** A ranged cache */
import { extendBuffer } from './buffer.js';

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
}

export type Range = { start: number; end: number };

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

	public constructor(
		/** The resource ID */
		public readonly id: ID,
		/** The full size of the resource */
		public size: number,
		protected readonly options: Options,
		resources?: Map<ID, Resource<ID> | undefined>
	) {
		options.sparse ??= true;
		if (!options.sparse) this.regions.push({ offset: 0, data: new Uint8Array(size), ranges: [] });

		resources?.set(id, this);
	}

	/**
	 * Ensure the full size of the resource is *at least* `newSize`
	 */
	public grow(newSize: number) {
		this.size = Math.max(this.size, newSize);
	}

	/** Combines adjacent regions and combines adjacent ranges within a region */
	public collect(): void {
		if (!this.options.sparse) return;
		const { regionGapThreshold = 0xfff } = this.options;

		for (let i = 0; i < this.regions.length - 1; ) {
			const current = this.regions[i];
			const next = this.regions[i + 1];

			if (next.offset - (current.offset + current.data.byteLength) > regionGapThreshold) {
				i++;
				continue;
			}

			// Combine ranges
			current.ranges.push(...next.ranges);
			current.ranges.sort((a, b) => a.start - b.start);

			// Combine overlapping/adjacent ranges
			current.ranges = current.ranges.reduce((acc: Range[], range) => {
				if (!acc.length || acc.at(-1)!.end < range.start) {
					acc.push(range);
				} else {
					acc.at(-1)!.end = Math.max(acc.at(-1)!.end, range.end);
				}
				return acc;
			}, []);

			// Extend buffer to include the new region
			current.data = extendBuffer(current.data, next.offset + next.data.byteLength);
			current.data.set(next.data, next.offset - current.offset);

			// Remove the next region after merging
			this.regions.splice(i + 1, 1);
		}
	}

	/** Takes an initial range and finds the sub-ranges that are not in the cache */
	public missing(start: number, end: number): Range[] {
		const missingRanges: Range[] = [];

		for (const region of this.regions) {
			if (region.offset >= end) break;

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

		for (const region of this.regions) {
			if (region.offset >= end) break;

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

	/** Get the region who's ranges include an offset */
	public regionAt(offset: number): Region | undefined {
		if (!this.regions.length) return;

		for (const region of this.regions) {
			if (region.offset > offset) break;

			// Check if the offset is within this region
			if (offset >= region.offset && offset < region.offset + region.data.byteLength) return region;
		}
	}

	/** Add new data to the cache at given specified offset */
	public add(data: Uint8Array, offset: number): this {
		const end = offset + data.byteLength;
		const region = this.regionAt(offset);

		if (region) {
			region.data = extendBuffer(region.data, end);
			region.data.set(data, offset);
			region.ranges.push({ start: offset, end });
			region.ranges.sort((a, b) => a.start - b.start);

			return this;
		}

		// Find the correct index to insert the new region
		const newRegion: Region = { data, offset: offset, ranges: [{ start: offset, end }] };
		const insertIndex = this.regions.findIndex(region => region.offset > offset);

		// Insert at the right index to keep regions sorted
		if (insertIndex == -1) {
			this.regions.push(newRegion); // Append if no later region exists
		} else {
			this.regions.splice(insertIndex, 0, newRegion); // Insert before the first region with a greater offset
		}

		return this;
	}
}
