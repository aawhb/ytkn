import { describe, expect, it } from 'vitest';
import {
	assertValidMindmapMermaid,
	parseConceptOutline,
	renderMindmapList,
	renderMindmapMermaid,
} from '../../src/rendering/conceptTree';

describe('parseConceptOutline', () => {
	it('parses a nested bullet outline into a single-root tree', () => {
		const tree = parseConceptOutline([
			'- Central idea',
			'  - Branch A',
			'    - Leaf 1',
			'    - Leaf 2',
			'  - Branch B',
			'    - Leaf 3',
		].join('\n'));

		expect(tree).not.toBeNull();
		expect(tree?.label).toBe('Central idea');
		expect(tree?.children.map((c) => c.label)).toEqual(['Branch A', 'Branch B']);
		expect(tree?.children[0].children.map((c) => c.label)).toEqual(['Leaf 1', 'Leaf 2']);
		expect(tree?.children[1].children.map((c) => c.label)).toEqual(['Leaf 3']);
	});

	it('ignores blank lines and %% comments and tolerates tabs and mixed markers', () => {
		const tree = parseConceptOutline([
			'%% a comment',
			'* Root',
			'',
			'\t- Child A',
			'\t\t+ Grandchild',
			'\t1. Child B',
		].join('\n'));

		expect(tree?.label).toBe('Root');
		expect(tree?.children.map((c) => c.label)).toEqual(['Child A', 'Child B']);
		expect(tree?.children[0].children.map((c) => c.label)).toEqual(['Grandchild']);
	});

	it('clamps stray shallow nodes under the single root rather than creating siblings', () => {
		const tree = parseConceptOutline([
			'- Root',
			'  - Child',
			'- Stray top-level',
		].join('\n'));

		expect(tree?.label).toBe('Root');
		expect(tree?.children.map((c) => c.label)).toEqual(['Child', 'Stray top-level']);
	});

	it('decodes HTML entities into clean semantic labels', () => {
		const tree = parseConceptOutline([
			'- Topic',
			'  - Design &amp;amp; Architecture',
		].join('\n'));

		expect(tree?.children[0].label).toBe('Design & Architecture');
	});

	it('returns null for empty or whitespace-only input', () => {
		expect(parseConceptOutline('')).toBeNull();
		expect(parseConceptOutline('   \n\n %% only a comment')).toBeNull();
	});

	it('skips a prose preface and anchors the root at the first list item', () => {
		const tree = parseConceptOutline('Here is the mindmap:\n- Root\n  - Child');
		expect(tree?.label).toBe('Root');
		expect(tree?.children.map((c) => c.label)).toEqual(['Child']);
	});

	it('returns null when there are no list items (all prose)', () => {
		expect(parseConceptOutline('Just prose\nno bullets here')).toBeNull();
	});

	it('skips trailing non-list prose lines', () => {
		const tree = parseConceptOutline("- Root\n  - Child\nThat's all folks");
		expect(tree?.label).toBe('Root');
		expect(tree?.children.map((c) => c.label)).toEqual(['Child']);
	});
});

describe('renderMindmapMermaid', () => {
	it('emits valid-by-construction mermaid with stable ids and 2-space indentation', () => {
		const tree = parseConceptOutline([
			'- Frequency Count',
			'  - Time Complexity',
			'    - O(sqrt(n))',
			'  - Design & Architecture',
		].join('\n'));

		const mermaid = renderMindmapMermaid(tree!);

		expect(mermaid).toBe([
			'mindmap',
			'  root(("Frequency Count"))',
			'    node1["Time Complexity"]',
			'      node2["O(sqrt(n))"]',
			'    node3["Design and Architecture"]',
		].join('\n'));
	});

	it('escapes string-breaking characters but keeps parentheses', () => {
		const tree = parseConceptOutline([
			'- Root',
			'  - Discovery -> Planning -> Execution',
			'  - Big O ($\\text{O}$)',
			'  - "Quoted" [bracketed]',
		].join('\n'));

		const mermaid = renderMindmapMermaid(tree!);

		expect(mermaid).toContain('node1["Discovery to Planning to Execution"]');
		expect(mermaid).toContain('node2["Big O (O)"]');
		expect(mermaid).toContain('node3["\'Quoted\' bracketed"]');
		expect(mermaid).not.toContain('$');
		expect(mermaid).not.toContain('->');
		expect(mermaid).not.toContain('[bracketed]');
	});
});

describe('escapeMermaidLabel (math rendering)', () => {
	const nodeLabel = (raw: string): string => {
		const tree = parseConceptOutline(`- Root\n  - ${raw}`)!;
		const match = renderMindmapMermaid(tree).match(/node1\["(.*)"\]/);
		return match![1];
	};

	it('converts LaTeX relations and operators to unicode, dropping $ delimiters', () => {
		expect(nodeLabel('$f(n) \\le C \\cdot G(n)$')).toBe('f(n) ≤ C ⋅ G(n)');
		expect(nodeLabel('$C_1 G(n) \\le f(n) \\le C_2 G(n)$')).toBe('C₁ G(n) ≤ f(n) ≤ C₂ G(n)');
	});

	it('converts greek commands and exponents (letters too)', () => {
		expect(nodeLabel('\\Theta(n^2)')).toBe('Θ(n²)');
		expect(nodeLabel('Upper bound n^n')).toBe('Upper bound nⁿ');
		expect(nodeLabel('2^n')).toBe('2ⁿ');
		expect(nodeLabel('2^K')).toBe('2ᴷ');
		expect(nodeLabel('n^k')).toBe('nᵏ');
		expect(nodeLabel('O(n^{K+1})')).toBe('O(nᴷ⁺¹)');
		expect(nodeLabel('e.g. 2n^2 + 3n + 4 ~ n^2')).toBe('e.g. 2n² + 3n + 4 ~ n²');
	});

	it('converts \\sqrt and \\sum but leaves the literal word sqrt alone', () => {
		expect(nodeLabel('O(\\sqrt{n})')).toBe('O(√n)');
		expect(nodeLabel('O(sqrt(n))')).toBe('O(sqrt(n))');
		expect(nodeLabel('\\sum (1/2)^i')).toBe('∑ (1/2)ⁱ');
		expect(nodeLabel('O(n log n)')).toBe('O(n log n)');
	});

	it('collapses nested \\frac into a parenthesised quotient', () => {
		expect(nodeLabel('Formula: \\frac{r^{K+1}-1}{r-1}')).toBe('Formula: (rᴷ⁺¹-1)/(r-1)');
	});

	it('renders mermaid-mangled comparison characters safely', () => {
		expect(nodeLabel('Stops when P > N')).toBe('Stops when P ＞ N');
		expect(nodeLabel('j < i pattern')).toBe('j ＜ i pattern');
		expect(nodeLabel('x <= y')).toBe('x ≤ y');
		expect(nodeLabel('x >= y')).toBe('x ≥ y');
		expect(nodeLabel('a != b')).toBe('a ≠ b');
	});

	it('maps \\dots to an ellipsis and joins spaced ampersands only', () => {
		expect(nodeLabel('1 + 2 + \\dots + K')).toBe('1 + 2 + … + K');
		expect(nodeLabel('Design & Architecture')).toBe('Design and Architecture');
		expect(nodeLabel('R&D')).toBe('R&D');
	});

	it('strips leading list markers so mermaid does not render them as lists', () => {
		expect(nodeLabel('1. Create Heap')).toBe('Create Heap');
		expect(nodeLabel('2. Repeated Deletion')).toBe('Repeated Deletion');
	});
});

describe('assertValidMindmapMermaid', () => {
	it('accepts output produced by the renderer', () => {
		const tree = parseConceptOutline('- A\n  - B\n    - C')!;
		expect(assertValidMindmapMermaid(renderMindmapMermaid(tree))).toBe(true);
	});

	it('rejects two node tokens on one line', () => {
		const broken = [
			'mindmap',
			'  root(("A"))',
			'    node1["B"] node2["C"]',
		].join('\n');
		expect(assertValidMindmapMermaid(broken)).toBe(false);
	});

	it('rejects unquoted node labels', () => {
		const broken = [
			'mindmap',
			'  root((A))',
			'    Raw Label',
		].join('\n');
		expect(assertValidMindmapMermaid(broken)).toBe(false);
	});
});

describe('renderMindmapList', () => {
	it('renders a nested bullet list fallback', () => {
		const tree = parseConceptOutline('- Root\n  - Child\n    - Leaf')!;
		expect(renderMindmapList(tree)).toBe([
			'- Root',
			'  - Child',
			'    - Leaf',
		].join('\n'));
	});
});
