import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../index';

const selectSelectedModel = (state: RootState) => state.model.selectedModel;
const selectCurrentSessionId = (state: RootState) => state.cowork.currentSessionId;
const selectQuotaState = (state: RootState) => state.quota;

export const selectQuotaOverview = createSelector(
  [selectQuotaState],
  (quotaState) => quotaState.overview
);

export const selectQuotaLoading = createSelector(
  [selectQuotaState],
  (quotaState) => quotaState.loading
);

export const selectQuotaModelsSnapshot = createSelector(
  [selectQuotaOverview],
  (overview) => overview.models
);

export const selectQuotaReservations = createSelector(
  [selectQuotaState],
  (quotaState) => quotaState.sessionReservations
);

export const findModelUsageMeta = (
  modelsSnapshot: ReturnType<typeof selectQuotaModelsSnapshot>,
  providerKey?: string,
  modelId?: string
) => {
  if (!providerKey || !modelId || !modelsSnapshot?.providers?.length) {
    return null;
  }

  return modelsSnapshot.providers
    .find((provider) => provider.provider === providerKey)
    ?.models.find((model) => model.model === modelId)
    ?.usageMeta ?? null;
};

export const selectSelectedModelUsageMeta = createSelector(
  [selectSelectedModel, selectQuotaModelsSnapshot],
  (selectedModel, modelsSnapshot) => {
    return findModelUsageMeta(modelsSnapshot, selectedModel?.providerKey, selectedModel?.id);
  }
);

export const selectCurrentSessionReservation = createSelector(
  [selectCurrentSessionId, selectQuotaReservations],
  (currentSessionId, reservations) => {
    if (!currentSessionId) {
      return null;
    }
    return reservations[currentSessionId] ?? null;
  }
);

export const selectQuotaBadgeViewModel = createSelector(
  [selectSelectedModel, selectQuotaOverview, selectQuotaLoading],
  (selectedModel, overview, loading) => {
    if (selectedModel?.source === 'local') {
      return {
        visible: false,
        loading: false,
        usedCreditsInRange: null,
        remainingCredits: null,
        isUnlimited: false,
      };
    }

    const quota = overview.quota;
    if (!quota && !loading) {
      return {
        visible: false,
        loading: false,
        usedCreditsInRange: null,
        remainingCredits: null,
        isUnlimited: false,
      };
    }

    return {
      visible: true,
      loading: loading && !quota,
      usedCreditsInRange: overview.usageSummary?.consumedCredits ?? null,
      remainingCredits: quota?.creditBalance ?? null,
      isUnlimited: quota?.isUnlimited === true,
    };
  }
);

export const selectQuotaPanelViewModel = createSelector(
  [
    selectSelectedModel,
    selectQuotaOverview,
    selectQuotaLoading,
    selectSelectedModelUsageMeta,
    selectCurrentSessionReservation,
  ],
  (selectedModel, overview, loading, currentModelMeta, sessionReservation) => ({
    isLocalModel: selectedModel?.source === 'local',
    selectedModelName: selectedModel?.name ?? null,
    currentModelMeta,
    quota: overview.quota,
    usage: overview.usageSummary,
    loading,
    sessionReservation,
  })
);
