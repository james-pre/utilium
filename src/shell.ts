// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2026 James Prevett

/**
 * Parse a line into arguments.
 * Supports single and double quoted strings as well as backslash escaping.
 */
export function splitIntoArgs(input: string): string[] {
	const args: string[] = [];
	let current = '',
		inQuote: '"' | "'" | null = null,
		escape = false;

	for (const char of input) {
		if (escape) {
			current += char;
			escape = false;
		} else if (char === '\\') {
			escape = true;
		} else if (inQuote) {
			if (char === inQuote) inQuote = null;
			else current += char;
		} else if (char === '"' || char === "'") inQuote = char;
		else if (/\s/.test(char)) {
			if (current.length) {
				args.push(current);
				current = '';
			}
		} else {
			current += char;
		}
	}
	if (current.length) args.push(current);
	return args;
}

/** Where a shell reads keystrokes from, i.e. the parts of `NodeJS.ReadStream` it uses. */
export interface ShellInput {
	on(event: 'data', listener: (chunk: string | Uint8Array) => void): unknown;
	off?(event: 'data', listener: (chunk: string | Uint8Array) => void): unknown;
	/** Hand over keystrokes as they are typed, instead of a line at a time with editing and echo */
	setRawMode?(raw: boolean): unknown;
	resume?(): unknown;
	pause?(): unknown;
	readonly isTTY?: boolean;
}

/**
 * Where a shell draws, i.e. the parts of `NodeJS.WriteStream` it uses.
 */
export interface ShellOutput {
	write(data: string): unknown;
	readonly columns?: number;
	readonly rows?: number;
}

export interface ShellOptions {
	/**
	 * The stream keystrokes are read from, e.g. `process.stdin`.
	 * The shell does its own line editing, so it is put into raw mode.
	 */
	stdin: ShellInput;

	/** The stream the prompt and the line being edited are written to, e.g. `process.stdout`. */
	stdout: ShellOutput;

	/** The prompt to use, can be a getter. */
	readonly prompt?: string;

	/** The length to use for the prompt. Useful if escape sequences are used in the prompt. */
	readonly promptLength?: number;

	/** The handler for when a line is parsed */
	onLine?(this: void, line: string): unknown;
}

export interface ShellContext extends Required<ShellOptions> {
	/** The input currently being shown */
	input: string;

	/** Where the cursor is in `input`. */
	cursor: number;

	/** The index for which input is being shown */
	index: number;

	/** The current, uncached input */
	currentInput: string;

	/** array of previous inputs */
	inputs: string[];

	/** Stop reading from `stdin` and put it back the way it was found */
	close(): void;
}

/**
 * One key press: a CSI or SS3 escape sequence, or a single character.
 * A read can come back with more than one key in it, e.g. when text is pasted,
 * and an escape sequence must not be taken for the characters it is made of.
 */
// eslint-disable-next-line no-control-regex
const keyPattern = /\x1b\[[0-?]*[ -\/]*[@-~]|\x1bO[@-~]|[\s\S]/gu;

async function handleKey($: ShellContext, key: string) {
	if ($.index == -1) {
		$.currentInput = $.input;
	}

	/** Redraw the whole line, for when the input is replaced rather than edited */
	function redraw(): void {
		$.stdout.write('\x1b[2K\r' + $.prompt + $.input);
		$.cursor = $.input.length;
	}

	switch (key) {
		case 'ArrowUp':
		case '\x1b[A':
			if ($.index < $.inputs.length - 1) {
				$.input = $.inputs[++$.index];
			}
			redraw();
			break;
		case 'ArrowDown':
		case '\x1b[B':
			if ($.index >= 0) {
				$.input = $.index-- == 0 ? $.currentInput : $.inputs[$.index];
			}
			redraw();
			break;
		case '\x1b[D':
			if ($.cursor > 0) {
				$.cursor--;
				$.stdout.write(key);
			}
			break;
		case '\x1b[C':
			if ($.cursor < $.input.length) {
				$.cursor++;
				$.stdout.write(key);
			}
			break;
		case '\x1b[F':
			$.cursor = $.input.length;
			$.stdout.write(`\x1b[${$.promptLength + $.cursor + 1}G`);
			break;
		case '\x1b[H':
			$.cursor = 0;
			$.stdout.write(`\x1b[${$.promptLength + 1}G`);
			break;
		case '\x7f':
			if ($.cursor <= 0) {
				return;
			}
			$.input = $.input.slice(0, $.cursor - 1) + $.input.slice($.cursor);
			$.cursor--;
			$.stdout.write('\b\x1b[P');
			break;
		case '\r':
			if ($.input != $.inputs[0]) {
				$.inputs.unshift($.input);
			}
			$.stdout.write('\r\n');
			await $.onLine($.input);
			$.index = -1;
			$.input = '';
			$.cursor = 0;
			$.stdout.write($.prompt);
			break;
		default: {
			if (key.startsWith('\x1b') || key < ' ') return;
			$.input = $.input.slice(0, $.cursor) + key + $.input.slice($.cursor);
			$.cursor += key.length;
			const rest = $.input.slice($.cursor);
			$.stdout.write(key + rest + (rest ? `\x1b[${rest.length}D` : ''));
		}
	}
}

/**
 * A simple wrapper for a pair of streams that makes implementing shells easier.
 */
export function createShell(options: ShellOptions): ShellContext {
	const decoder = new TextDecoder();

	const context: ShellContext = {
		stdin: options.stdin,
		stdout: options.stdout,
		get prompt() {
			return options.prompt ?? '';
		},
		get promptLength() {
			return options.promptLength ?? this.prompt.length;
		},
		onLine: options.onLine ?? (() => {}),
		input: '',
		cursor: 0,
		index: -1,
		currentInput: '',
		inputs: [],
		close() {
			options.stdin.off?.('data', listener);
			options.stdin.setRawMode?.(false);
			options.stdin.pause?.();
		},
	};

	let pending = Promise.resolve();

	const listener = (chunk: string | Uint8Array) => {
		const data = typeof chunk == 'string' ? chunk : decoder.decode(chunk, { stream: true });

		pending = pending.then(async () => {
			for (const [key] of data.matchAll(keyPattern)) await handleKey(context, key);
		});
	};

	options.stdin.setRawMode?.(true);
	options.stdin.on('data', listener);
	options.stdin.resume?.();

	return context;
}
