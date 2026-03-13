## Context

The change introduces a unified model/provider configuration across main and renderer, with tenant-managed configs, local editable providers, and legacy migration paths. It spans main-process config resolution, settings UI/UX, and API routing (including Coding Plan endpoint switches), plus a new SQLite-backed user preferences store.

## Goals / Non-Goals

**Goals:**
- Provide a single resolved model configuration that merges tenant config, user preferences, and legacy app_config deterministically.
- Persist user preferences (theme/language/proxy/shortcuts) and local provider overrides in SQLite with migration.
- Modernize the Settings > Model UI to clearly separate managed providers from editable local providers and support model CRUD.
- Ensure API routing uses the selected provider/model and correct endpoint semantics (Anthropic vs OpenAI compatibility, Responses API where needed).

**Non-Goals:**
- Changing remote tenant config formats or server APIs.
- Expanding support for new provider types beyond those already listed.
- Reworking the cowork execution engine or artifact system beyond configuration inputs.

## Decisions

- Introduce shared model config types (`src/shared/modelConfig.ts`) to avoid duplicated schemas between main/renderer.
  - Alternative: continue per-layer schemas; rejected due to drift and inconsistent resolution.
- Resolve configuration in main via `modelConfigResolver` with precedence: user preferences → tenant defaults → legacy defaults → first enabled model.
  - Alternative: tenant always wins; rejected to preserve user overrides for local providers.
- Store preferences in SQLite (`user_preferences`) with a migration from legacy app_config.
  - Alternative: keep localStore in renderer; rejected to centralize persistence and enable tray/main-process access.
- UI split into provider list + details panel with model CRUD modal components to reduce complexity in Settings.tsx.
  - Alternative: keep single monolith component; rejected due to readability and extensibility.

## Risks / Trade-offs

- [Migration correctness] → Validate migration logic to avoid losing legacy settings; keep fallback to legacy config if preferences missing.
- [Config precedence confusion] → Surface resolved provider/model in UI and keep tenant-managed providers read-only.
- [Endpoint mismatch] → Keep explicit API format selection and base URL normalization; add provider-specific defaults.
- [State divergence] → Ensure configService applies user preferences locally after save.
