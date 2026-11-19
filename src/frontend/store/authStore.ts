// =============================================================================
// GTV Media Sales — Store Zustand : Authentification
// Gère le token JWT et l'utilisateur connecté.
// persist middleware : survit au refresh de page (localStorage).
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../../api/types';

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,

      login: (token, user) => {
        localStorage.setItem('gtv_token', token);
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('gtv_token');
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'gtv-auth',
      // Ne persiste que le token et l'user, pas les fonctions
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
