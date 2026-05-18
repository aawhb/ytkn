# Templates

Templates represent knowledge jobs: the answer to “what am I trying to do with this video?” Each template defines the expected body sections and the kind of synthesis the model should perform.

## Built-in templates

| Template | Best for |
| --- | --- |
| General knowledge note | Balanced summary, takeaways, applications, and limits |
| Study notes | Recall-friendly notes with prerequisites, concepts, walkthrough, self-test, and to-remember bullets |
| Implementation note | Concrete steps, code, tools, gotchas, and action items |
| Deep dive | Permanent topic notes with canonical concept, mental model, components, common confusions, and open threads |
| Full extract | Exhaustive archive of claims, examples, tools, people, sources, numbers, and quotes |
| Research dossier | Inquiry-shaped notes with claims, evidence strength, missing information, and sources to chase |

## Renderer guarantees

All built-in templates produce renderer-driven notes.

The renderer guarantees:

- body sections are emitted in the template-declared order, regardless of the order returned by the AI provider
- source identity fields such as title, channel, video ID, playlist ID, and URLs are renderer-owned
- AI output cannot override source metadata
- missing required sections can produce a run-report entry for playlist runs or an in-app Notice for single-video runs

This keeps source metadata stable even when model output is imperfect.

## Per-template runtime controls

Some templates expose runtime fields in the generation modal to shape the output per run.

| Template | Control | Values |
| --- | --- | --- |
| Study notes | Learner level | intro / intermediate / advanced |
| Deep dive | Audience level | intro / intermediate / advanced |
| Full extract | Extraction density | concise / comprehensive / exhaustive |
| Research dossier | Research inquiry | free text research question |
| Research dossier | Epistemic strictness | lenient / standard / strict |

These controls are prompt-only. They shape vocabulary depth, section depth, strictness, and focus, but do not write frontmatter.

## Manual instructions

If none of the built-in templates fit, switch the instruction style to **Manual** and provide your own prompt.

Manual instructions still run inside the plugin's renderer-owned note shell, so source metadata and outer note structure remain deterministic.

## Choosing a template

Use this quick guide:

- Choose **General knowledge note** when you want a reliable default.
- Choose **Study notes** when you want recall, review, and self-testing.
- Choose **Implementation note** when you plan to act on the video.
- Choose **Deep dive** when the video explains a durable concept worth turning into a reference note.
- Choose **Full extract** when preserving detail matters more than brevity.
- Choose **Research dossier** when you are investigating a question and care about evidence strength.
