import React, { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { fetchStreamingWindow, incrementTick, setTelemetryData } from './store/telemetrySlice';
import { recordStreamingTick } from './store/energySlice';
import { Header } from './components/Header';
import { OperatingSwitchBar } from './components/OperatingSwitchBar';
import { Stage1Oscilloscope } from './components/Stage1Oscilloscope';
import { Stage2CostMatrixTable } from './components/Stage2CostMatrixTable';
import { Stage3DecisionHighway } from './components/Stage3DecisionHighway';
import { Stage4Spectrogram } from './components/Stage4Spectrogram';
import { Stage5EnergySubsystem } from './components/Stage5EnergySubsystem';
import { BackendCrashOverlay } from './components/BackendCrashOverlay';
import {
  computeCalibratedProbabilities,
  computeExpectedRiskVector,
  evaluateDeferralDecision,
  ASYMMETRIC_COST_MATRIX,
} from './utils/mathPipeline';

export const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    operatingMode,
    isStreaming,
    streamTick,
    temperatureT,
    riskThreshold,
    isOutageFailSafe,
    isLoading,
    error,
  } = useAppSelector((state) => state.telemetry);

  // Keep refs for tick interval to avoid stale closures
  const stateRef = useRef({
    operatingMode,
    streamTick,
    temperatureT,
    riskThreshold,
    isOutageFailSafe,
    isStreaming,
  });

  useEffect(() => {
    stateRef.current = {
      operatingMode,
      streamTick,
      temperatureT,
      riskThreshold,
      isOutageFailSafe,
      isStreaming,
    };
  }, [operatingMode, streamTick, temperatureT, riskThreshold, isOutageFailSafe, isStreaming]);

  // Execute single 1-second streaming tick
  const executeTick = useCallback(async () => {
    const {
      operatingMode: mode,
      streamTick: currentTick,
      temperatureT: temp,
      riskThreshold: thresh,
      isOutageFailSafe: failSafe,
    } = stateRef.current;

    const action = await dispatch(
      fetchStreamingWindow({
        mode,
        windowIdx: currentTick,
      })
    );

    if (fetchStreamingWindow.fulfilled.match(action)) {
      const data = action.payload;
      const logits = data.raw_logits || [0, 0, 0, 0, 0, 0, 0, 0];
      const cal = computeCalibratedProbabilities(logits, temp);
      const risk = computeExpectedRiskVector(cal.calibratedProbabilities, ASYMMETRIC_COST_MATRIX);
      const gate = evaluateDeferralDecision(risk.minRisk, thresh);

      let finalDecision: 'KEEP_LOCAL' | 'OFFLOAD_CLOUD' | 'FAILSAFE_LOCAL' = gate.decision;
      if (gate.isOffloadRecommended && failSafe) {
        finalDecision = 'FAILSAFE_LOCAL';
      }

      dispatch(
        recordStreamingTick({
          windowIdx: data.window_idx ?? currentTick,
          timestamp_s: currentTick,
          stateName: data.state_name,
          decision: finalDecision,
          minRisk: risk.minRisk,
          threshold: thresh,
          isFailSafeActive: failSafe && gate.isOffloadRecommended,
        })
      );

      dispatch(incrementTick());
    }
  }, [dispatch]);

  // WebSocket Live Push Integration (Throttled & Decoupled)
  useEffect(() => {
    const host = window.location.hostname || '127.0.0.1';
    const wsUrl = `ws://${host}:8000/ws`;
    let ws: WebSocket | null = null;
    let retryTimer: any = null;

    const connectWs = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            dispatch(setTelemetryData(payload));
          } catch {
            // ignore
          }
        };
        ws.onclose = () => {
          retryTimer = setTimeout(connectWs, 2000);
        };
        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch {
        retryTimer = setTimeout(connectWs, 2000);
      }
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [dispatch]);

  // Initial load tick
  useEffect(() => {
    executeTick();
  }, [executeTick]);

  // Continuous 1-Second (1000 ms) Live Streaming Loop
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      if (stateRef.current.isStreaming) {
        executeTick();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming, executeTick]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-mono selection:bg-emerald-500 selection:text-black antialiased">
      {/* Strict Backend Crash Check: Zero-Mock Enforced */}
      {error && (
        <BackendCrashOverlay
          error={error}
          onRetry={executeTick}
          isRetrying={isLoading}
        />
      )}

      {/* Industrial SCADA Top Workbench Header */}
      <Header />

      {/* Pinned Viewport Container with Smooth Contained Scroll */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 max-w-[1920px] mx-auto w-full">
        {/* Top Operating Bar: Mode 1/2 Switch, Link Outage Toggle, Cadence Controls */}
        <OperatingSwitchBar onStepOneSecond={executeTick} />

        {/* TOP ROW: STAGE 1 (Oscilloscope) & STAGE 2 (Cost Matrix Diagnostic Table) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
          <div className="xl:col-span-7">
            <Stage1Oscilloscope />
          </div>
          <div className="xl:col-span-5">
            <Stage2CostMatrixTable />
          </div>
        </div>

        {/* MIDDLE ROW: STAGE 3 (Decision Highway Banner & Analog Risk Dial) */}
        <Stage3DecisionHighway />

        {/* BOTTOM ROW: STAGE 4 (CUDA Spectrogram Heatmap) & STAGE 5 (Energy Subsystem) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
          <div className="xl:col-span-7">
            <Stage4Spectrogram />
          </div>
          <div className="xl:col-span-5">
            <Stage5EnergySubsystem />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
