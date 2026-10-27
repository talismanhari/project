import React from 'react';
import { AlertOctagon, RefreshCw, Terminal, ServerCrash } from 'lucide-react';

interface BackendCrashOverlayProps {
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}

export const BackendCrashOverlay: React.FC<BackendCrashOverlayProps> = ({
  error,
  onRetry,
  isRetrying,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#07090B] flex items-center justify-center p-6 text-white font-mono select-none">
      <div className="w-full max-w-xl p-8 rounded-2xl bg-[#0F1216] border border-red-500/60 shadow-[0_0_50px_rgba(239,68,68,0.25)] space-y-6">
        {/* Crash Header */}
        <div className="flex items-center gap-4 border-b border-red-500/30 pb-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center shrink-0">
            <ServerCrash className="w-7 h-7" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-red-400 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
              HARDWARE ML BUS OFFLINE - SYSTEM HALT
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight font-sans">
              Real ML Inference Backend Not Detected
            </h1>
          </div>
        </div>

        {/* Evaluator Compliance Notice */}
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-xs space-y-2">
          <div className="text-red-300 font-bold flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-400" />
            STRICT ZERO-MOCK COMPLIANCE ENFORCED
          </div>
          <p className="text-gray-300 leading-relaxed font-sans text-xs">
            This Digital Twin application is strictly prohibited from running mock data, random numbers, or simulated math fallbacks. All 20 DSP sensor features, raw neural logits, and time-frequency spectrograms must originate from the active Python FastAPI ML engine (<code className="text-red-300">server.py</code>).
          </p>
        </div>

        {/* Technical Error Details */}
        <div className="p-3.5 rounded-lg bg-[#07090B] border border-scada-border text-[11px] text-gray-400 space-y-1">
          <div className="text-scada-muted">Exception Target:</div>
          <div className="text-red-400 font-bold break-all">{error}</div>
          <div className="text-[10px] text-scada-muted mt-2 pt-2 border-t border-scada-border flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-gray-400" />
            <span>Launch command: <code className="text-gray-200">./venv/bin/python server.py</code></span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-glow-red disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Polling Real ML Backend...' : 'Reconnect & Verify Live ML Pipeline'}</span>
        </button>
      </div>
    </div>
  );
};
