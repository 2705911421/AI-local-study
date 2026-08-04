# Frontend Design Tools

The redesign references two locally deployed design tool repositories:

- `taste-skill`: https://github.com/leonxlnx/taste-skill
- `impeccable`: https://github.com/pbakaus/impeccable

They are cloned into `.design-tools/` for local inspection and are intentionally ignored by Git because they are development references rather than runtime dependencies.

Current shallow clone revisions:

- `taste-skill`: `e988add`
- `impeccable`: `c5e1ddd`

The production page remains a native React/Vite implementation. This keeps the `/app` workspace route, existing release manifest, and desktop build independent from the external tool repositories.
