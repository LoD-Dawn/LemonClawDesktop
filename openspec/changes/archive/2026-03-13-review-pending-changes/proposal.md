## Why

The current model/provider configuration is split across legacy app_config and ad hoc settings logic, making it hard to reconcile tenant-managed models with user-specific local providers. This change formalizes a resolved model configuration and modernizes the settings UX to reduce misconfiguration and improve provider selection.

## What Changes

- Add a shared model configuration schema and resolver that merges tenant config, user preferences, and legacy config with clear precedence.
- Introduce user preference storage/migration in SQLite for theme/language/proxy/shortcuts and local providers (Ollama/Custom).
- Refactor the Settings > Model UI into a structured provider panel with managed vs editable providers, model list editing, and import/export for local providers.
- Update API configuration resolution to respect selected provider/model and provider-specific endpoint variants (e.g., Coding Plan endpoints).

## Capabilities

### New Capabilities
- `model-provider-config`: Unified provider/model configuration with tenant + local preference resolution and editable local providers.

### Modified Capabilities
- (none)

## Impact

- Main process: config resolution, preferences storage, IPC for resolved model config, tray labels, and cowork settings integration.
- Renderer: settings UI overhaul, provider model editor dialogs, API config selection logic.
- Shared types: model config schema used across main/renderer.
- Storage: new SQLite key for user preferences; migration from legacy app_config.
