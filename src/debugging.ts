/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CreateLoggerOptions {
	output?: (...args: any[]) => void;
	separator?: string;
	returnValue?: boolean;
	stringify?: (value: unknown) => string;
}

function defaultStringify(value: unknown): string {
	if (value === null) return 'null';
	if (value === undefined) return 'undefined';
	// eslint-disable-next-line @typescript-eslint/no-base-to-string
	return value.toString();
}

type LoggableDecoratorContext = Exclude<DecoratorContext, ClassFieldDecoratorContext>;

/**
 * Create a function that can be used to decorate classes and non-field members.
 */
export function createLogDecorator(options: CreateLoggerOptions) {
	const { output = console.log, separator = '#', returnValue = false, stringify = defaultStringify } = options;

	return function log<T extends (...args: any[]) => any>(value: T, context: LoggableDecoratorContext): T {
		if (context.kind == 'class') {
			return function (...args: any[]) {
				output(`new ${value.name} (${args.map(stringify).join(', ')})`);
				return Reflect.construct(value, args);
			} as T;
		}

		return function (this: any, ...args: any[]) {
			const prefix = this.constructor.name + separator + context.name.toString();

			output(`${prefix}(${args.map(stringify).join(', ')})`);

			const result = value.call(this, ...args);

			if (returnValue) output(' => ' + stringify(result));

			return result;
		} as T;
	};
}
