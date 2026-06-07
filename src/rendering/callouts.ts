export function renderCollapsedCallout(type: string, title: string, body: string): string {
	return [
		`> [!${type}]- ${title}`,
		...body.split('\n').map((line) => line ? `> ${line}` : '>'),
	].join('\n');
}
