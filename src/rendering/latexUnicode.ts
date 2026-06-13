const BRACE_GROUP = '\\{((?:[^{}]|\\{[^{}]*\\})*)\\}';

const FRACTION = new RegExp(`\\\\[dt]?frac\\s*${BRACE_GROUP}\\s*${BRACE_GROUP}`, 'g');
const SQRT_BRACED = new RegExp(`\\\\sqrt\\s*${BRACE_GROUP}`, 'g');
const TEXT_WRAPPER = new RegExp(
	`\\\\(?:text|mathrm|mathbf|mathit|mathsf|mathtt|mathnormal|operatorname|textbf|textit|textrm|mbox|hbox)\\s*${BRACE_GROUP}`,
	'g',
);

const WORD_COMMANDS: Readonly<Record<string, string>> = {
	Alpha: 'Α',
	Beta: 'Β',
	Delta: 'Δ',
	Gamma: 'Γ',
	Lambda: 'Λ',
	Omega: 'Ω',
	Phi: 'Φ',
	Pi: 'Π',
	Sigma: 'Σ',
	Theta: 'Θ',
	alpha: 'α',
	approx: '≈',
	beta: 'β',
	cdot: '⋅',
	cdots: '…',
	delta: 'δ',
	div: '÷',
	dots: '…',
	dotsb: '…',
	dotsc: '…',
	dotsm: '…',
	epsilon: 'ε',
	equiv: '≡',
	eta: 'η',
	gamma: 'γ',
	ge: '≥',
	geq: '≥',
	in: '∈',
	infty: '∞',
	int: '∫',
	lambda: 'λ',
	ldots: '…',
	le: '≤',
	leq: '≤',
	left: '',
	lim: 'lim',
	log: 'log',
	ln: 'ln',
	mp: '∓',
	mu: 'μ',
	ne: '≠',
	neq: '≠',
	omega: 'ω',
	phi: 'φ',
	pi: 'π',
	pm: '±',
	prod: '∏',
	propto: '∝',
	quad: ' ',
	qquad: ' ',
	right: '',
	rightarrow: '→',
	rho: 'ρ',
	sigma: 'σ',
	sim: '~',
	sum: '∑',
	tau: 'τ',
	theta: 'θ',
	times: '×',
	to: '→',
	top: '⊤',
	varepsilon: 'ε',
	varphi: 'φ',
	vartheta: 'ϑ',
};

const SUPERSCRIPTS: Readonly<Record<string, string>> = {
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹',
	'+': '⁺',
	'-': '⁻',
	'=': '⁼',
	'(': '⁽',
	')': '⁾',
	a: 'ᵃ',
	b: 'ᵇ',
	c: 'ᶜ',
	d: 'ᵈ',
	e: 'ᵉ',
	i: 'ⁱ',
	j: 'ʲ',
	k: 'ᵏ',
	l: 'ˡ',
	m: 'ᵐ',
	n: 'ⁿ',
	o: 'ᵒ',
	p: 'ᵖ',
	r: 'ʳ',
	s: 'ˢ',
	t: 'ᵗ',
	u: 'ᵘ',
	v: 'ᵛ',
	w: 'ʷ',
	x: 'ˣ',
	y: 'ʸ',
	z: 'ᶻ',
	A: 'ᴬ',
	B: 'ᴮ',
	D: 'ᴰ',
	E: 'ᴱ',
	G: 'ᴳ',
	H: 'ᴴ',
	I: 'ᴵ',
	J: 'ᴶ',
	K: 'ᴷ',
	L: 'ᴸ',
	M: 'ᴹ',
	N: 'ᴺ',
	O: 'ᴼ',
	P: 'ᴾ',
	R: 'ᴿ',
	T: 'ᵀ',
	U: 'ᵁ',
	V: 'ⱽ',
	W: 'ᵂ',
};

const SUBSCRIPTS: Readonly<Record<string, string>> = {
	'0': '₀',
	'1': '₁',
	'2': '₂',
	'3': '₃',
	'4': '₄',
	'5': '₅',
	'6': '₆',
	'7': '₇',
	'8': '₈',
	'9': '₉',
	'+': '₊',
	'-': '₋',
	'=': '₌',
	'(': '₍',
	')': '₎',
	a: 'ₐ',
	e: 'ₑ',
	h: 'ₕ',
	i: 'ᵢ',
	j: 'ⱼ',
	k: 'ₖ',
	l: 'ₗ',
	m: 'ₘ',
	n: 'ₙ',
	o: 'ₒ',
	p: 'ₚ',
	r: 'ᵣ',
	s: 'ₛ',
	t: 'ₜ',
	u: 'ᵤ',
	v: 'ᵥ',
	x: 'ₓ',
};

function repeatReplace(input: string, pattern: RegExp, replacement: string): string {
	let out = input;
	let prev: string;
	do {
		prev = out;
		out = out.replace(pattern, replacement);
	} while (out !== prev);
	return out;
}

function mapScript(op: string, body: string): string {
	const table = op === '^' ? SUPERSCRIPTS : SUBSCRIPTS;
	const mapped = [...body].map((ch) => table[ch]);
	if (mapped.every((glyph) => glyph !== undefined)) {
		return mapped.join('');
	}
	return body.length > 1 ? `${op}(${body})` : `${op}${body}`;
}

function isEscaped(source: string, index: number): boolean {
	let backslashCount = 0;
	for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) {
		backslashCount += 1;
	}
	return backslashCount % 2 === 1;
}

function isInlineMathDelimiter(source: string, index: number): boolean {
	return source[index] === '$'
		&& !isEscaped(source, index)
		&& source[index - 1] !== '$'
		&& source[index + 1] !== '$';
}

function isInsideInlineMath(source: string, offset: number): boolean {
	let openingDelimiter = -1;
	for (let index = 0; index < offset; index += 1) {
		if (isInlineMathDelimiter(source, index)) {
			openingDelimiter = openingDelimiter === -1 ? index : -1;
		}
	}
	if (openingDelimiter === -1) {
		return false;
	}

	for (let index = offset; index < source.length; index += 1) {
		if (isInlineMathDelimiter(source, index)) {
			return true;
		}
	}
	return false;
}

function applyScripts(input: string): string {
	return input
		.replace(/([\^_])\{([^{}]*)\}/g, (_match, op: string, body: string) => mapScript(op, body))
		.replace(/\^(\S)/g, (_match, ch: string) => mapScript('^', ch))
		.replace(/_(\S)/g, (match, ch: string, offset: number, source: string) => {
			const precedingToken = source.slice(0, offset).match(/[A-Za-z0-9]+$/)?.[0] ?? '';
			const insideMath = isInsideInlineMath(source, offset);
			const isSingleSymbolSubscript = /[0-9+\-=()]/.test(ch) && precedingToken.length === 1;
			return insideMath || isSingleSymbolSubscript ? mapScript('_', ch) : match;
		});
}

export function latexToReadable(input: string): string {
	let result = repeatReplace(input, TEXT_WRAPPER, '$1');
	result = repeatReplace(result, FRACTION, '($1)/($2)');
	result = repeatReplace(result, SQRT_BRACED, '√$1');
	result = result.replace(/\\sqrt\s+(\S+)/g, '√$1');
	result = result.replace(/\\[,;!:]/g, ' ');
	result = result.replace(/\\([A-Za-z]+)/g, (_match, command: string) => (
		Object.prototype.hasOwnProperty.call(WORD_COMMANDS, command) ? WORD_COMMANDS[command] : command
	));
	result = applyScripts(result);
	return result.replace(/[${}\\]/g, '');
}
