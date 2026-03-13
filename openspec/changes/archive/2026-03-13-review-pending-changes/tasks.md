## 1. Data model + storage

- [x] 1.1 Define shared model config types in src/shared/modelConfig.ts
- [x] 1.2 Implement user preferences store + migration in src/main/libs/userPreferencesStore.ts
- [x] 1.3 Wire preferences into main IPC (get/update) and tray labels

## 2. Resolution + API routing

- [x] 2.1 Implement modelConfigResolver and integrate with claudeSettings / cowork config
- [x] 2.2 Update openai-compat proxy and apiService to use resolved provider + endpoint rules

## 3. Settings UI

- [x] 3.1 Split Settings model UI into provider list + detail panel + model dialog components
- [x] 3.2 Implement provider import/export for local providers
- [x] 3.3 Persist local provider edits and apply preferences on save
