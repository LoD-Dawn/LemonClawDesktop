## ADDED Requirements

### Requirement: Resolve model configuration
The system SHALL resolve a model configuration by merging tenant configuration, user preferences, and legacy app config in a deterministic order.

#### Scenario: Preferred user model is available
- **WHEN** user preferences specify a model that exists in the resolved providers list
- **THEN** the system selects that provider/model pair as the active model

#### Scenario: Tenant default model is available
- **WHEN** user preferences do not specify a valid model and the tenant config default exists in resolved providers
- **THEN** the system selects the tenant default provider/model pair

#### Scenario: Legacy defaults are available
- **WHEN** neither user preferences nor tenant defaults resolve and legacy app_config has a default model
- **THEN** the system selects the legacy default provider/model pair

#### Scenario: No defaults are available
- **WHEN** none of the above defaults resolve and providers include enabled models
- **THEN** the system selects the first enabled model as the active model

### Requirement: Persist user preferences
The system SHALL persist user preferences (theme, language, proxy, shortcuts, and local provider configs) in main-process storage.

#### Scenario: First launch after migration
- **WHEN** no user_preferences record exists and legacy app_config is present
- **THEN** the system migrates and stores user preferences derived from legacy app_config

#### Scenario: User saves settings
- **WHEN** the user saves settings
- **THEN** the system updates user preferences in main-process storage and applies them locally

### Requirement: Manage local providers
The system SHALL allow editing of local providers (Ollama and Custom) including enabling, API endpoints, and models.

#### Scenario: Editable provider list
- **WHEN** the settings model panel is opened
- **THEN** only local providers are editable and managed providers are read-only

#### Scenario: Add or edit model
- **WHEN** the user adds or edits a model for a local provider
- **THEN** the model list updates and persists on save
