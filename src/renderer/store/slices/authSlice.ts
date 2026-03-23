import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser, AuthStatus } from '../../types/auth';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

const initialState: AuthState = {
  status: 'checking',
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthChecking(state) {
      state.status = 'checking';
    },
    setAuthLoggedIn(state, action: PayloadAction<AuthUser>) {
      state.status = 'logged_in';
      state.user = action.payload;
    },
    setAuthLoggedOut(state) {
      state.status = 'logged_out';
      state.user = null;
    },
  },
});

export const { setAuthChecking, setAuthLoggedIn, setAuthLoggedOut } = authSlice.actions;
export default authSlice.reducer;
