// ─────────────────────────────────────────────────────────────────────────────
// Session store — carries the active GameBundle between the loading screen and
// the play page. On a hard refresh of /play, this is empty, so the play page
// re-fetches by user_key (see /app/play/page.tsx). Kept separate from the
// gameplay store (gameStore) so play-progress logic stays focused.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type { GameBundle } from "@/types/bundle";

interface SessionState {
  bundle: GameBundle | null;
  setBundle: (bundle: GameBundle) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  bundle: null,
  setBundle: (bundle) => set({ bundle }),
  clear: () => set({ bundle: null }),
}));
