import assert from 'node:assert';
import { closeSync, openSync, readSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BufferView } from '../src/buffer.js';
import { encodeASCII } from '../src/string.js';
import { member, sizeof, struct, types as t } from '../src/struct.js';

@struct()
class Duck extends BufferView {
	@t.char(64) public accessor name: Uint8Array = new Uint8Array(64);
	@t.float32 public accessor age: number = 0;
	@t.float32 public accessor weight: number = 0;
	@t.float32 public accessor height: number = 0;
}

@struct()
class MamaDuck extends Duck {
	@t.uint16 public accessor n_ducklings: number = 0;

	@member(Duck, { length: 'n_ducklings' }) public accessor ducklings: Duck[] = [];
}

const duckData = new ArrayBuffer(sizeof(MamaDuck) + sizeof(Duck) * 2);

const gerald = Object.assign(new Duck(duckData, sizeof(MamaDuck)), {
	name: encodeASCII('Gerald'),
	age: 1,
	weight: 2,
	height: 3,
});

const donald = Object.assign(new Duck(duckData, sizeof(MamaDuck) + sizeof(Duck)), {
	name: encodeASCII('Donald'),
	age: 2,
	weight: 30,
	height: 4,
});

const mama = Object.assign(new MamaDuck(duckData, 0, duckData.byteLength), {
	name: encodeASCII('Mama'),
	age: 9.6,
	weight: 12,
	height: 9,
	ducklings: [gerald, donald],
	n_ducklings: 2,
});

const mom = new MamaDuck(duckData, 0, duckData.byteLength);

assert.deepEqual(mom, mama);

writeFileSync(join(import.meta.dirname, '../tmp/ducks.bin'), new Uint8Array(duckData));

const mom2data = new Uint8Array(duckData.byteLength);

const fd = openSync(join(import.meta.dirname, '../tmp/ducks.bin'), 'r');
readSync(fd, mom2data, 0, mom2data.length, 0);
closeSync(fd);

const mom2 = new MamaDuck(mom2data, 0, mom2data.byteLength);

assert.deepEqual(mom2, mama);
