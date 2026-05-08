import { Notice } from 'obsidian';
import { getErrorMessage } from '../utils';

export function notifyError(prefix: string, error: unknown, ...context: unknown[]): void {
	console.error(`${prefix}:`, error, ...context);
	new Notice(`${prefix}: ${getErrorMessage(error)}`);
}
