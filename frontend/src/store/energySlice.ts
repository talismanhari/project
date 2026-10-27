import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { InferenceCycleLog } from '../types';

interface EnergyState {
  cycleCount: number;
  tinyDeferCumulative_mJ: number;
  baselineCumulative_mJ: number;
  history: InferenceCycleLog[];
  lastDecision: 'KEEP_LOCAL' | 'OFFLOAD_CLOUD' | 'FAILSAFE_LOCAL';
}

const initialState: EnergyState = {
  cycleCount: 0,
  tinyDeferCumulative_mJ: 0.0,
  baselineCumulative_mJ: 0.0,
  history: [],
  lastDecision: 'KEEP_LOCAL',
};

export const energySlice = createSlice({
  name: 'energy',
  initialState,
  reducers: {
    recordStreamingTick: (
      state,
      action: PayloadAction<{
        windowIdx: number;
        timestamp_s: number;
        stateName: string;
        decision: 'KEEP_LOCAL' | 'OFFLOAD_CLOUD' | 'FAILSAFE_LOCAL';
        minRisk: number;
        threshold: number;
        isFailSafeActive?: boolean;
      }>
    ) => {
      state.cycleCount += 1;
      const { windowIdx, timestamp_s, stateName, decision, minRisk, threshold, isFailSafeActive } = action.payload;

      state.lastDecision = decision;

      // Kumar et al. (2026 Base Paper) Stochastic 92.4% Offload Model:
      // ~11 out of 12 seconds it wakes Wi-Fi (~1490 - 1525 mJ)
      // ~1 out of 12 seconds it resolves locally (~2.2 mJ)
      const isKumarOffload = (windowIdx % 12 !== 5); // 11/12 = 91.7% ~ 92.4%
      const kumarDelta = isKumarOffload
        ? 1490.0 + (windowIdx % 7) * 5.0 + Math.sin(windowIdx) * 6.0
        : 2.2 + (windowIdx % 3) * 0.2;
      
      state.baselineCumulative_mJ += kumarDelta;

      // TinyDefer Energy Modeling:
      // LOCAL: ~0.50 mJ with realistic +/- 0.04 mJ ADC shunt jitter (0.48 - 0.54 mJ)
      // OFFLOAD: ~1500 mJ with realistic Wi-Fi RF burst jitter (1495 - 1515 mJ)
      // FAILSAFE: 0.50 mJ local fail-safe execution (Wi-Fi link forced OFF)
      let tinyDeferDelta = 0.50;
      if (decision === 'OFFLOAD_CLOUD') {
        tinyDeferDelta = 1500.0 + (windowIdx % 5) * 3.5 + Math.cos(windowIdx) * 4.0;
      } else {
        // Local execution (nominal or fail-safe): 0.50 mJ +/- 0.04 mJ jitter
        const adcNoise = ((windowIdx * 17) % 9 - 4) * 0.01;
        tinyDeferDelta = Number((0.50 + adcNoise).toFixed(3));
      }
      state.tinyDeferCumulative_mJ += tinyDeferDelta;

      const logEntry: InferenceCycleLog = {
        cycleId: windowIdx,
        timestamp: `${timestamp_s.toFixed(0)}s`,
        stateName,
        decision,
        minRisk,
        threshold,
        tinyDeferEnergy: Number(tinyDeferDelta.toFixed(3)),
        baselineEnergy: Number(kumarDelta.toFixed(1)),
        cumulativeTinyDefer: Number(state.tinyDeferCumulative_mJ.toFixed(2)),
        cumulativeBaseline: Number(state.baselineCumulative_mJ.toFixed(1)),
        isFailSafeActive,
      };

      state.history.push(logEntry);
      // Keep rolling window of last 30 seconds for high-density visual oscilloscope
      if (state.history.length > 30) {
        state.history.shift();
      }
    },

    resetEnergyLogger: (state) => {
      state.cycleCount = 0;
      state.tinyDeferCumulative_mJ = 0.0;
      state.baselineCumulative_mJ = 0.0;
      state.history = [];
      state.lastDecision = 'KEEP_LOCAL';
    },
  },
});

export const { recordStreamingTick, resetEnergyLogger } = energySlice.actions;

export default energySlice.reducer;
