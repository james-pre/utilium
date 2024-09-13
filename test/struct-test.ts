import { writeFileSync } from 'fs';
import { deserialize, member, serialize, struct, types as t } from '../src/struct.js';
import { join } from 'path';

@struct()
class Header {
	@t.char(4) public readonly magic_start = 'test';

	@t.uint16 public segments: number = 0;

	@t.char(4) public readonly magic_end = 'end';
}

@struct()
class AnotherHeader extends Header {
	@t.uint64 public _plus = 0x12345678;
}

@struct()
class Segment {
	@t.uint64 public id = 0x021;
	@t.uint32(64) public data: number[] = [];
}

@struct()
class BinObject {
	@member(AnotherHeader)
	header: AnotherHeader = new AnotherHeader();

	@t.char(32)
	comment: string = '';

	@member(Segment, 16)
	public segments: Segment[] = [new Segment()];
}

const obj = new BinObject();
obj.comment = '!!! Omg, hi! this is cool' + '.'.repeat(32);
obj.header.segments = 1;

const segment = new Segment();
segment.data = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
serialize(segment);
obj.segments = [segment];

const bin = serialize(obj);
writeFileSync(join(import.meta.dirname, '../tmp/bin'), bin);

const omg = new BinObject();
deserialize(omg, bin);

console.log(omg);
