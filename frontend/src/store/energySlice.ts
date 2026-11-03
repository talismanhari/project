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

      // Stage 5 Dual Energy Profiler Modeling:
      // Baseline (Always Cloud): Continuous linear accumulation E_baseline(t) = t * 1.5 J/s (1500 mJ/s)
      const kumarDelta = 1500.0;
      state.baselineCumulative_mJ += kumarDelta;

      // Pure Edge Inference: P_ESP32 * dt_infer = 3.3V * 95mA * 65ms = 20.4 mJ
      // Deferred Offload: 20.4 mJ + (3.3V * 320mA * 1400ms) = 1500 mJ
      let tinyDeferDelta = 20.4;
      if (decision === 'OFFLOAD_CLOUD') {
        tinyDeferDelta = 1500.0 + (windowIdx % 5) * 3.5;
      } else {
        // Local execution (nominal or fail-safe): 20.4 mJ +/- 0.35 mJ shunt jitter
        const adcNoise = ((windowIdx * 17) % 9 - 4) * 0.08;
        tinyDeferDelta = Number((20.4 + adcNoise).toFixed(2));
      }
      state.tinyDeferCumulative_mJ += tinyDeferDelta;

      const logEntry: InferenceCycleLog = {
        cycleId: windowIdx,
        timestamp: `${timestamp_s.toFixed(0)}s`,
        stateName,
        decision,
        minRisk,
        threshold,
        tinyDeferEnergy: Number(tinyDeferDelta.toFixed(2)),
        baselineEnergy: Number(kumarDelta.toFixed(1)),
        cumulativeTinyDefer: Number((state.tinyDeferCumulative_mJ / 1000.0).toFixed(3)), // in Joules
        cumulativeBaseline: Number((state.baselineCumulative_mJ / 1000.0).toFixed(3)),   // in Joules
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
