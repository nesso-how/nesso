# OpenCode model overrides

`models.ts` lets the ignored `.opencode/models.json` file choose the model and
reasoning effort for the Atlante `architect`, `general`, and `explore` roles.

OpenCode loads the committed project configuration first. This local plugin
then applies the ignored model file at startup, without changing prompts,
permissions, modes, tools, or other agent settings.

## File format

The file is strict JSON and accepts only these role keys. Each role may specify
`model`, `reasoningEffort`, or both:

```json
{
  "architect": {
    "model": "provider/model",
    "reasoningEffort": "high"
  },
  "general": {
    "model": "provider/model",
    "reasoningEffort": "max"
  },
  "explore": {
    "model": "provider/model",
    "reasoningEffort": "high"
  }
}
```

If the file is missing, the plugin creates starter defaults and applies them
for the current startup. Malformed JSON, unknown roles or fields, invalid model
references, and empty reasoning values fail before changing the host config.

Restart OpenCode after changing this plugin or `.opencode/models.json`.
