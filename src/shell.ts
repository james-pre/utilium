/* A simple wrapper for xterm.js that makes implementing shells easier */
import type { Terminal } from '@xterm/xterm';

export interface ShellContext {
	/**
	 * The terminal associate with the context
	 */
	terminal: Terminal;

	/**
	 *
	 */
	input: string;

	/**
	 * The index for which input is being shown
	 */
	index: number;

	/**
	 * The current, uncached input
	 */
	currentInput: string;

	/**
	 * array of previous inputs
	 */
	inputs: string[];

	/**
	 * The prompt to use.
	 * Can be a getter.
	 */
	readonly prompt: string;

	/**
	 * The handler for when a line is parsed
	 */
	onLine(this: void, line: string): unknown;
}

/**
 * Creates a new shell context from some options
 * @internal
 */
export function createShellContext({ terminal, prompt = '', onLine = () => {} }: ShellOptions): ShellContext {
	return {
		terminal,
		prompt,
		onLine,
		input: '',
		index: -1,
		currentInput: '',
		inputs: [],
	};
}

function handleData($: ShellContext, data: string) {
	if ($.index == -1) {
		$.currentInput = $.input;
	}

	function clear(): void {
		$.terminal.write('\x1b[2K\r' + $.prompt);
	}
	const x = $.terminal.buffer.active.cursorX - $.prompt.length;
	switch (data) {
		case 'ArrowUp':
		case '\x1b[A':
			clear();
			if ($.index < $.inputs.length - 1) {
				$.input = $.inputs[++$.index];
			}
			$.terminal.write($.input);
			break;
		case 'ArrowDown':
		case '\x1b[B':
			clear();
			if ($.index >= 0) {
				$.input = $.index-- == 0 ? $.currentInput : $.inputs[$.index];
			}
			$.terminal.write($.input);
			break;
		case '\x1b[D':
			if (x > 0) {
				$.terminal.write(data);
			}
			break;
		case '\x1b[C':
			if (x < $.currentInput.length) {
				$.terminal.write(data);
			}
			break;
		case '\x1b[F':
			$.terminal.write(`\x1b[${$.prompt.length + $.currentInput.length + 1}G`);
			break;
		case '\x1b[H':
			$.terminal.write(`\x1b[${$.prompt.length + 1}G`);
			break;
		case '\x7f':
			if (x <= 0) {
				return;
			}
			$.terminal.write('\b\x1b[P');
			$.input = $.input.slice(0, x - 1) + $.input.slice(x);
			break;
		case '\r':
			if ($.input != $.inputs[0]) {
				$.inputs.unshift($.input);
			}
			$.index = -1;
			$.input = '';
			$.terminal.write('\r\n');
			$.onLine($.currentInput);
			$.terminal.write($.prompt);
			break;
		default:
			$.terminal.write(data);
			$.input = $.input.slice(0, x) + data + $.input.slice(x);
	}
}

export interface ShellOptions {
	terminal: Terminal;

	readonly prompt?: string;

	onLine?(this: void, line: string): unknown;
}

export function createShell(options: ShellOptions): ShellContext {
	const context = createShellContext(options);
	options.terminal.onData(data => handleData(context, data));
	return context;
}
