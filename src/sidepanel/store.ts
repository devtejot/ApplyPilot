import { create } from 'zustand';
import type { ErrorCode } from '@/shared/types';

// Side-panel state machine (DESIGN.md §11):
// idle → detecting → detected → extracting → analyzed → generating → filled → done
//  (any) → error → back to prior state
export type PanelStatus =
  | 'idle'
  | 'detecting'
  | 'detected'
  | 'extracting'
  | 'analyzed'
  | 'generating'
  | 'filled'
  | 'done'
  | 'error';

interface PanelState {
  status: PanelStatus;
  error: { code: ErrorCode; detail: string } | null;
  setStatus: (status: PanelStatus) => void;
  setError: (code: ErrorCode, detail: string) => void;
  reset: () => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  status: 'idle',
  error: null,
  setStatus: (status) => set({ status, error: null }),
  setError: (code, detail) => set({ status: 'error', error: { code, detail } }),
  reset: () => set({ status: 'idle', error: null }),
}));
