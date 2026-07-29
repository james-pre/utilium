// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright (c) 2026 James Prevett

// Misc. Node.js utilities

/** Whether this process is running with escalated privileges */
export const isRoot =
	'process' in globalThis
	&& (process.platform === 'win32'
		? process
				.getBuiltinModule?.('child_process')
				.spawnSync((process.env.SystemRoot || 'C:\\Windows') + '\\System32\\fltmc.exe', {
					stdio: 'ignore',
					windowsHide: true,
				}).status === 0
		: process.geteuid?.() === 0
			|| process.getegid?.() === 0
			|| process.getuid?.() === 0
			|| process.getgid?.() === 0);
