# Templates

Templates represent knowledge jobs: the answer to “what am I trying to get out of this video?”

Each template tells the model what kind of note to produce, while the plugin keeps the outer note structure deterministic.

## Choose the right template

| Template | Best when you need | Runtime controls |
| --- | --- | --- |
| General knowledge note | A reliable default with summary, takeaways, applications, and limits | None |
| Study notes | Review-friendly notes for learning, recall, and self-testing | Learner level: `intro`, `intermediate`, `advanced` |
| Implementation note | Concrete steps, tools, gotchas, and action items | None |
| Deep dive | A durable reference note for an important concept | Audience level: `intro`, `intermediate`, `advanced` |
| Full extract | Detail preservation over brevity | Extraction density: `concise`, `comprehensive`, `exhaustive` |
| Research dossier | Investigating a question, claim, or source landscape | Research inquiry (free text), epistemic strictness: `lenient`, `standard`, `strict` |

## What templates guarantee

Built-in templates do more than suggest a prompt. They also work with the renderer's guarantees:

- sections are emitted in the template's declared order
- source metadata stays renderer-owned
- AI output cannot overwrite source identity fields like title, channel, URLs, or IDs
- missing required sections can surface as warnings or run-report entries

That keeps notes predictable even when model output is imperfect.

## Built-in templates at a glance

### General knowledge note

Choose this when you want the best default. It aims for balanced coverage without turning every video into a mini-thesis.

### Study notes

Choose this when you want to review the material later, teach it, or test yourself on it. The learner-level control helps you tune the depth.

### Implementation note

Choose this when the video is something you want to act on. It favors steps, tools, execution details, and practical cautions.

### Deep dive

Choose this when the video explains a durable concept worth turning into a long-lived reference note.

### Full extract

Choose this when detail matters more than brevity. It is the best fit when you want a dense archive of claims, examples, tools, numbers, or quotes.

### Research dossier

Choose this when you are investigating a question and care about evidence strength, gaps, and follow-up sources. The inquiry and strictness controls help steer the output.

## Manual instructions

If none of the built-in templates fit, switch the instruction style to **Manual** and write your own instructions.

Manual mode is still wrapped inside the plugin's deterministic note shell, so source metadata, headings, and transcript handling remain under plugin control.

## When to change templates instead of changing models

If a note feels wrong, the first fix is often the template, not the provider.

Examples:

- too broad or generic → try **Deep dive** or **Research dossier**
- too detailed → try **General knowledge note**
- not actionable enough → try **Implementation note**
- not review-friendly enough → try **Study notes**
- not preserving enough detail → try **Full extract**

## Related docs

- [Getting started](getting-started.md) for your first run
- [Workflows](usage.md) for batching and playlists
- [Configuration](configuration.md) for default template, manual instructions, and AI settings
