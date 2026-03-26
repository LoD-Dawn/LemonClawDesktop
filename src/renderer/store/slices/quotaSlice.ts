import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ClawQuotaOverview, ClawSessionReservation } from '../../../shared/quota';

interface QuotaState {
  overview: ClawQuotaOverview;
  loading: boolean;
  error: string | null;
  sessionReservations: Record<string, ClawSessionReservation | null | undefined>;
  liveUsedCreditsBase: number | null;
}

const initialState: QuotaState = {
  overview: {
    models: null,
    quota: null,
    usageSummary: null,
  },
  loading: false,
  error: null,
  sessionReservations: {},
  liveUsedCreditsBase: null,
};

const quotaSlice = createSlice({
  name: 'quota',
  initialState,
  reducers: {
    setQuotaLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setQuotaError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setQuotaOverview(state, action: PayloadAction<ClawQuotaOverview>) {
      state.overview = action.payload;
      state.error = null;
      const nextBalance = action.payload.quota?.creditBalance;
      if (nextBalance !== null && nextBalance !== undefined && Number.isFinite(nextBalance)) {
        state.liveUsedCreditsBase = state.liveUsedCreditsBase === null
          ? nextBalance
          : Math.max(state.liveUsedCreditsBase, nextBalance);
      }
    },
    mergeQuotaOverview(state, action: PayloadAction<Partial<ClawQuotaOverview>>) {
      state.overview = {
        models: action.payload.models !== undefined ? action.payload.models : state.overview.models,
        quota: action.payload.quota !== undefined ? action.payload.quota : state.overview.quota,
        usageSummary: action.payload.usageSummary !== undefined ? action.payload.usageSummary : state.overview.usageSummary,
      };
      state.error = null;
      const nextBalance = state.overview.quota?.creditBalance;
      if (nextBalance !== null && nextBalance !== undefined && Number.isFinite(nextBalance)) {
        state.liveUsedCreditsBase = state.liveUsedCreditsBase === null
          ? nextBalance
          : Math.max(state.liveUsedCreditsBase, nextBalance);
      }
    },
    setSessionReservation(state, action: PayloadAction<{ sessionId: string; reservation: ClawSessionReservation | null }>) {
      state.sessionReservations[action.payload.sessionId] = action.payload.reservation;
    },
    clearSessionReservation(state, action: PayloadAction<string>) {
      delete state.sessionReservations[action.payload];
    },
  },
});

export const {
  setQuotaLoading,
  setQuotaError,
  setQuotaOverview,
  mergeQuotaOverview,
  setSessionReservation,
  clearSessionReservation,
} = quotaSlice.actions;

export default quotaSlice.reducer;
