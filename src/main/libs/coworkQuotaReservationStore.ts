import type { SqliteStore } from '../sqliteStore';
import type {
  ClawHeartbeatStatus,
  ClawSessionEntry,
  ClawSessionReservation,
} from '../../shared/quota';

export type PersistedReservation = ClawSessionReservation & {
  entry: ClawSessionEntry;
  heartbeatSeq: number;
  heartbeatStatus: ClawHeartbeatStatus;
  localTotalActiveSeconds: number;
  phaseStartedAtMs: number | null;
  workspacePath?: string | null;
};

const STORE_KEY = 'cowork_quota_state_v1';

export class CoworkQuotaReservationStore {
  private store: SqliteStore;

  constructor(store: SqliteStore) {
    this.store = store;
  }

  hydrate(): Map<string, PersistedReservation> {
    const reservations = new Map<string, PersistedReservation>();
    const raw = this.store.get<Record<string, PersistedReservation>>(STORE_KEY) ?? {};
    Object.entries(raw).forEach(([sessionId, reservation]) => {
      if (!reservation || typeof reservation !== 'object') {
        return;
      }
      reservations.set(sessionId, {
        ...reservation,
        phaseStartedAtMs: null,
        heartbeatStatus: reservation.closed ? 'paused' : reservation.heartbeatStatus ?? 'paused',
        localTotalActiveSeconds: Math.max(
          Number(reservation.localTotalActiveSeconds || 0),
          Number(reservation.serverAcceptedTotalActiveSeconds || 0)
        ),
        heartbeatSeq: Number(reservation.heartbeatSeq || 0),
      });
    });
    return reservations;
  }

  persist(reservations: Map<string, PersistedReservation>): void {
    const serialized: Record<string, PersistedReservation> = {};
    reservations.forEach((reservation, sessionId) => {
      serialized[sessionId] = {
        ...reservation,
        phaseStartedAtMs: null,
      };
    });
    this.store.set(STORE_KEY, serialized);
  }
}
