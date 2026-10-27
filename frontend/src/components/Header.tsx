import React from 'react';
import { useAppSelector } from '../store';
import { Cpu } from 'lucide-react';

export const Header: React.FC = () => {
  const { isLoading, telemetryData } = useAppSelector((state) => state.telemetry);

  return (
    <header className="border-b border-scada-border bg-[#0B0D10] px-6 py-3 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Academic Title & Benchmark Scope */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                Edge AI Digital Twin Workbench
              </span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />
                REAL ML BACKEND ONLINE
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight font-sans">
              Empirical Cost Modeling of Calibrated Inference Deferral in Microcontroller Edge AI
            </h1>
          </div>
        </div>

        {/* Right: Hardware Specs */}
        <div className="flex items-center gap-4 text-[11px] text-scada-muted">
          <div className="flex items-center gap-2">
            <span>SoC: <strong className="text-gray-200">ESP32-S3 (240MHz)</strong></span>
            <span>•</span>
            <span>Core 0 DSP: <strong className="text-gray-200">12.0 kHz</strong></span>
            <span>•</span>
            <span>Core 1 TinyML: <strong className="text-emerald-400">QAT INT8</strong></span>
          </div>
        </div>
      </div>
    </header>
  );
};
