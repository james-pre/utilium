import { writeFileSync } from 'fs';
import assert from 'node:assert';
import { join } from 'path';
import { encodeASCII } from '../src/string.js';
import { member, struct, StructView, types as t } from '../src/struct.js';

enum Some {
	thing = 1,
	one = 2,
}

@struct()
class Header extends StructView {
	@t.char(4) public accessor magic_start = encodeASCII('test');

	@t.uint16 public accessor segments: number = 0;

	@t.char(4) public accessor magic_end = encodeASCII('end\0');
}

@struct()
class AnotherHeader extends Header {
	@t.uint64 public accessor _plus: bigint = 0x12345678n;

	@t.uint16 public accessor some: Some = Some.thing;
}

@struct()
class Segment extends StructView {
	@t.uint64 public accessor id = 0x021;
	@t.uint32(64) public accessor data: number[] = [];
}

@struct()
class BinObject extends StructView {
	@member(AnotherHeader) public accessor header = new AnotherHeader();

	@t.char(32) public accessor comment: string = '';

	@member(Segment, 16) public accessor segments: Segment[] = [new Segment()];
}

const obj = new BinObject();
obj.comment = '!!! Omg, hi! this is cool' + '.'.repeat(32);
obj.header.segments = 1;

const segment = new Segment();
segment.data = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

obj.segments = [segment];

const bin = new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength);
writeFileSync(join(import.meta.dirname, '../tmp/bin'), bin);

const omg = new BinObject(bin);

assert.deepEqual(omg.header.magic_start, obj.header.magic_start);
assert.equal(omg.header.segments, obj.header.segments);
assert.deepEqual(omg.header.magic_end, obj.header.magic_end);
assert.equal(omg.header._plus, obj.header._plus);
assert(typeof omg.header._plus == 'bigint');
assert.deepEqual(omg.comment, obj.comment.slice(0, 32));

console.log(omg);
