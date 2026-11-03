import React, { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { fetchStreamingWindow, incrementTick } from './store/telemetrySlice';
import { recordStreamingTick } from './store/energySlice';
import { Header } from './components/Header';
import { OperatingSwitchBar } from './components/OperatingSwitchBar';
import { PanelASensorInput } from './components/PanelASensorInput';
import { PanelBDecisionHighway } from './components/PanelBDecisionHighway';
import { PanelCCloudDeepDive } from './components/PanelCCloudDeepDive';
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
    <div className="h-screen w-screen overflow-hidden bg-[#07090C] text-[#F3F4F6] flex flex-col font-mono selection:bg-emerald-500 selection:text-black antialiased">
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
      <main className="flex-1 overflow-y-auto p-3.5 lg:p-5 space-y-4 max-w-[1920px] mx-auto w-full">
        {/* Top Operating Bar: Mode 1/2 Switch, Link Outage Toggle, Cadence Controls */}
        <OperatingSwitchBar onStepOneSecond={executeTick} />

        {/* PANEL A: THE INPUT (Raw & Quantized Signals) */}
        <PanelASensorInput />

        {/* PANEL B: THE DECISION HIGHWAY (Center Stage - Massive Visibility) */}
        <PanelBDecisionHighway />

        {/* PANEL C: CLOUD DEEP-DIVE (Triggered on Deferral) */}
        <PanelCCloudDeepDive />
      </main>
    </div>
  );
};

export default App;
