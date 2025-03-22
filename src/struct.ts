import { BufferViewArray } from './buffer.js';
import { _debugLog } from './debugging.js';
import * as primitive from './internal/primitives.js';
import type {
	DecoratorContext,
	Instance,
	InstanceLike,
	Member,
	Metadata,
	Options,
	Size,
	StaticLike,
	TypeLike,
} from './internal/struct.js';
import { checkStruct, initMetadata, isInstance, isStatic, isStruct } from './internal/struct.js';
import { _throw } from './misc.js';
import { getAllPrototypes } from './objects.js';
export * as Struct from './internal/struct.js';

/**
 * Gets the size in bytes of a type
 */
export function sizeof<T extends TypeLike>(type: T | T[]): Size<T> {
	if (type === undefined || type === null) return 0 as Size<T>;

	if (Array.isArray(type)) {
		let size = 0;

		for (let i = 0; i < type.length; i++) {
			size += sizeof(type[i]);
		}

		return size as Size<T>;
	}

	// primitive or character
	if (typeof type == 'string') {
		primitive.checkValid(type);

		return primitive.types[primitive.normalize(type)].size as Size<T>;
	}

	if (primitive.isType(type)) return type.size as Size<T>;

	checkStruct(type);

	const constructor = isStatic(type) ? type : type.constructor;
	const { struct, structInit } = constructor[Symbol.metadata];

	if (isStatic(type) || !struct.isDynamic) return struct.staticSize as Size<T>;

	const last = structInit.members.at(-1)!;
	const length = (type as any)[last.length as keyof typeof type];
	let dynamicSize = 0;

	if (primitive.isType(last.type)) {
		dynamicSize = last.type.size * length;
	} else {
		const value = type[last.name];

		for (let i = 0; i < length; i++) {
			dynamicSize += sizeof(isStruct(value[i]) ? value[i] : last.type);
		}
	}

	return (struct.isUnion ? Math.max(struct.staticSize, dynamicSize) : struct.staticSize + dynamicSize) as Size<T>;
}

/**
 * Returns the offset (in bytes) of a member in a struct.
 */
export function offsetof(type: StaticLike | InstanceLike, memberName: string): number {
	checkStruct(type);

	const constructor = isStatic(type) ? type : type.constructor;

	const member = constructor[Symbol.metadata].struct.members.get(memberName);

	if (!member) throw new Error('Struct does not have member: ' + memberName);

	return member.offset;
}

/** Aligns a number */
export function align(value: number, alignment: number): number {
	return Math.ceil(value / alignment) * alignment;
}

/**
 * Decorates a class as a struct
 */
export function struct(options: Partial<Options> = {}) {
	return function _decorateStruct<T extends StaticLike>(
		target: T,
		context: ClassDecoratorContext<T> & DecoratorContext
	): void {
		const init = initMetadata(context);

		const members = new Map<string, Member>();

		for (const member of init.members) {
			if (options.isUnion) member.offset = 0;

			_debugLog('define', target.name + '.' + member.name);

			members.set(member.name, member);
		}

		context.metadata.struct = {
			options,
			members,
			staticSize: init.size,
			isDynamic: init.isDynamic,
			isUnion: options.isUnion ?? false,
		} satisfies Metadata;
	};
}

export interface MemberOptions {
	bigEndian?: boolean;
	length?: number | string;
	align?: number;
	typeName?: string;
}

/**
 * Decorates a class member to be serialized
 */
export function member<V>(type: primitive.Type | StaticLike, opt: MemberOptions = {}) {
	return function __decorateMember(value: Target<V>, context: Context<V>): Result<V> {
		if (context.kind != 'accessor') throw new Error('Member must be an accessor');

		const init = initMetadata(context);

		if (init.isDynamic) throw new Error('Dynamic members must be declared at the end of the struct');

		let name = context.name;
		if (typeof name == 'symbol') {
			console.warn('Symbol used for struct member name will be coerced to string: ' + name.toString());
			name = name.toString();
		}

		if (!name) throw new ReferenceError('Invalid name for struct member');

		if (!primitive.isType(type) && !isStatic(type)) throw new TypeError('Not a valid type: ' + type.name);

		if (typeof opt.length == 'string') {
			const countedBy = init.members.find(m => m.name == opt.length);

			if (!countedBy) throw new Error(`"${opt.length}" is not declared and cannot be used to count "${name}"`);

			if (!primitive.isType(countedBy.type))
				throw new Error(`"${opt.length}" is not a number and cannot be used to count "${name}"`);

			init.isDynamic = true;
		}

		const size = align(
			sizeof(type) * (typeof opt.length == 'string' ? 0 : (opt.length ?? 1)),
			opt.align ?? sizeof(type)
		);

		const member = {
			name,
			offset: init.size,
			type,
			length: opt.length,
			size,
			decl: `${opt.typeName ?? type.name} ${name}${opt.length !== undefined ? `[${JSON.stringify(opt.length)}]` : ''}`,
			littleEndian: !opt.bigEndian,
		} satisfies Member;

		init.members.push(member);

		// Apply after setting `offset`
		init.size += size;

		return {
			get() {
				return _get(this, member);
			},
			set(value) {
				_set(this, member, value);
			},
		};
	};
}

/** Gets the length of a member */
function _memberLength<T extends Metadata>(instance: Instance<T>, length?: number | string): number {
	if (length === undefined) return -1;
	if (typeof length == 'string') return instance[length];
	return Number.isSafeInteger(length) && length >= 0
		? length
		: _throw(new Error('Array lengths must be natural numbers'));
}

function _set(instance: Instance, member: Member, value: any, index?: number) {
	const { name, type, length: rawLength } = member;
	const length = _memberLength(instance, rawLength);

	if (!primitive.isType(type)) {
		if (!isInstance(value)) return _debugLog(`Tried to set "${name}" to a non-instance value`);

		if (length > 0 && typeof index != 'number') {
			for (let i = 0; i < length; i++) _set(instance, member, value[i], i);
			return;
		}

		if (!Array.from(getAllPrototypes(value.constructor)).some(c => c === type))
			throw new Error(`${value.constructor.name} is not a subtype of ${type.name}`);

		const offset = instance.byteOffset + member.offset + (index ?? 0) * sizeof(type);

		// It's already the same value
		if (value.buffer === instance.buffer && value.byteOffset === offset) return;

		const current = new Uint8Array(instance.buffer, offset, sizeof(value));

		current.set(new Uint8Array(value.buffer, value.byteOffset, sizeof(value)));

		return;
	}

	const view = new DataView(instance.buffer, instance.byteOffset, instance.byteLength);

	if (length > 0 && typeof index != 'number') {
		for (let i = 0; i < length; i++) {
			const offset = member.offset + i * type.size;
			type.set(view, offset, member.littleEndian, value[i]);
		}
		return;
	}

	if (typeof value == 'string') value = value.charCodeAt(0);

	type.set(view, member.offset + (index ?? 0) * type.size, member.littleEndian, value);
}

function _get(instance: Instance, member: Member, index?: number) {
	const { type, length: rawLength } = member;
	const length = _memberLength(instance, rawLength);

	if (length > 0 && typeof index != 'number') {
		return new (primitive.isType(type) ? type.array : BufferViewArray(type, sizeof(type)))(
			instance.buffer,
			instance.byteOffset + member.offset,
			length * sizeof(type)
		);
	}

	const offset = member.offset + (index ?? 0) * sizeof(type);

	if (isStatic(type)) return new type(instance.buffer, offset, sizeof(type));

	const view = new DataView(instance.buffer, instance.byteOffset, instance.byteLength);
	return type.get(view, offset, member.littleEndian);
}

// Decorator utility types
type Target<V> = ClassAccessorDecoratorTarget<any, V>;
type Result<V> = ClassAccessorDecoratorResult<any, V>;
type Context<V> = ClassAccessorDecoratorContext<any, V> & DecoratorContext;
type Decorator<V> = (value: Target<V>, context: Context<V>) => Result<V>;

function _member<T extends primitive.Valid>(typeName: T) {
	const type = primitive.types[primitive.normalize(typeName)];

	function _structMemberDecorator<V>(length: number | string): Decorator<V>;
	function _structMemberDecorator<V>(value: Target<V>, context: Context<V>): Result<V>;
	function _structMemberDecorator<V>(
		valueOrLength: Target<V> | number | string,
		context?: Context<V>
	): Decorator<V> | Result<V> {
		return typeof valueOrLength == 'number' || typeof valueOrLength == 'string'
			? member<V>(type, { length: valueOrLength, typeName })
			: member<V>(type, { typeName })(valueOrLength, context!);
	}

	return _structMemberDecorator;
}

/**
 * Shortcut types
 *
 * Instead of writing `@member(type)` you can write `@types.type`, or `@types.type(length)` for arrays
 */
export const types = Object.fromEntries(primitive.validNames.map(t => [t, _member(t)])) as {
	[K in primitive.Valid]: ReturnType<typeof _member<K>>;
};
