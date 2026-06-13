import { describe, expect, it } from 'vitest';
import { latexToReadable } from '../../src/rendering/latexUnicode';

describe('latexToReadable', () => {
	it('converts known whole commands and degrades unknown commands to plain text', () => {
		expect(latexToReadable('\\input data')).toBe('input data');
		expect(latexToReadable('\\topology')).toBe('topology');
		expect(latexToReadable('x \\in S')).toBe('x ∈ S');
		expect(latexToReadable('A \\top B')).toBe('A ⊤ B');
		expect(latexToReadable('\\customThing')).toBe('customThing');
	});

	it('converts known symbols, fractions, and scripts', () => {
		expect(latexToReadable('a \\le b')).toBe('a ≤ b');
		expect(latexToReadable('a \\ge b \\neq c')).toBe('a ≥ b ≠ c');
		expect(latexToReadable('C \\cdot D')).toBe('C ⋅ D');
		expect(latexToReadable('A \\rightarrow B')).toBe('A → B');
		expect(latexToReadable('\\sum x')).toBe('∑ x');
		expect(latexToReadable('\\Theta(n)')).toBe('Θ(n)');
		expect(latexToReadable('\\sqrt{n}')).toBe('√n');
		expect(latexToReadable('\\frac{a}{b}')).toBe('(a)/(b)');
		expect(latexToReadable('n^{K+1}')).toBe('nᴷ⁺¹');
		expect(latexToReadable('$x_i$')).toBe('xᵢ');
	});

	it('leaves plain text untouched, including non-English', () => {
		expect(latexToReadable('Análisis asintótico 日本語')).toBe('Análisis asintótico 日本語');
		expect(latexToReadable('Growth Relationships')).toBe('Growth Relationships');
		expect(latexToReadable('user_id and max_heap')).toBe('user_id and max_heap');
		expect(latexToReadable('Saves $400/mo on api_costs vs gpt_4')).toBe('Saves 400/mo on api_costs vs gpt_4');
		expect(latexToReadable('Costs \\$3 per run_id lookup')).toBe('Costs 3 per run_id lookup');
		expect(latexToReadable('$$x_i$$')).toBe('x_i');
	});

	it('does not resolve inherited object properties as LaTeX commands', () => {
		expect(latexToReadable('use \\constructor here')).toBe('use constructor here');
		expect(latexToReadable('use \\toString here')).toBe('use toString here');
	});
});
