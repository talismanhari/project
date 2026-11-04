import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TelemetryPayload } from '../types';

export type OperatingMode = 'MODE_1_NORMAL' | 'MODE_2_SEVERE';

interface TelemetryState {
  operatingMode: OperatingMode;
  isStreaming: boolean;
  streamTick: number;
  temperatureT: number;
  riskThreshold: number;
  isOutageFailSafe: boolean;
  telemetryData: TelemetryPayload | null;
  isLoading: boolean;
  error: string | null;
  isMathDrawerOpen: boolean;
}

const initialState: TelemetryState = {
  operatingMode: 'MODE_1_NORMAL',
  isStreaming: true,
  streamTick: 1,
  temperatureT: 1.45,
  riskThreshold: 1.70,
  isOutageFailSafe: false,
  telemetryData: null,
  isLoading: false,
  error: null,
  isMathDrawerOpen: false,
};

export const fetchStreamingWindow = createAsyncThunk<
  TelemetryPayload,
  { mode: OperatingMode; windowIdx: number },
  { rejectValue: string }
>('telemetry/fetchStreamingWindow', async ({ mode, windowIdx }, { rejectWithValue }) => {
  try {
    const response = await fetch('http://127.0.0.1:8000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, window_idx: windowIdx }),
    });
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: Failed to reach FastAPI ML server`);
    }
    const data: TelemetryPayload = await response.json();
    return data;
  } catch (err: any) {
    return rejectWithValue(
      err.message || 'Cannot connect to Python FastAPI ML backend at http://127.0.0.1:8000'
    );
  }
});

export const telemetrySlice = createSlice({
  name: 'telemetry',
  initialState,
  reducers: {
    setOperatingMode: (state, action: PayloadAction<OperatingMode>) => {
      state.operatingMode = action.payload;
    },
    toggleStreaming: (state) => {
      state.isStreaming = !state.isStreaming;
    },
    setStreaming: (state, action: PayloadAction<boolean>) => {
      state.isStreaming = action.payload;
    },
    incrementTick: (state) => {
      state.streamTick += 1;
    },
    resetClock: (state) => {
      state.streamTick = 1;
    },
    setTemperatureT: (state, action: PayloadAction<number>) => {
      state.temperatureT = action.payload;
    },
    setRiskThreshold: (state, action: PayloadAction<number>) => {
      state.riskThreshold = action.payload;
    },
    toggleOutageFailSafe: (state) => {
      state.isOutageFailSafe = !state.isOutageFailSafe;
    },
    setOutageFailSafe: (state, action: PayloadAction<boolean>) => {
      state.isOutageFailSafe = action.payload;
    },
    toggleMathDrawer: (state) => {
      state.isMathDrawerOpen = !state.isMathDrawerOpen;
    },
    setMathDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.isMathDrawerOpen = action.payload;
    },
    setTelemetryData: (state, action: PayloadAction<TelemetryPayload>) => {
      state.telemetryData = action.payload;
      state.isLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStreamingWindow.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchStreamingWindow.fulfilled, (state, action) => {
        state.isLoading = false;
        state.telemetryData = action.payload;
      })
      .addCase(fetchStreamingWindow.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Backend Connection Failure';
      });
  },
});

export const {
  setOperatingMode,
  toggleStreaming,
  setStreaming,
  incrementTick,
  resetClock,
  setTemperatureT,
  setRiskThreshold,
  toggleOutageFailSafe,
  setOutageFailSafe,
  toggleMathDrawer,
  setMathDrawerOpen,
  setTelemetryData,
} = telemetrySlice.actions;

export default telemetrySlice.reducer;
