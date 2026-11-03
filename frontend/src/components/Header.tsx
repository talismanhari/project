import React from 'react';
import { Cpu, Server } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-[#1E293B] bg-[#0B0F19] px-4 lg:px-6 py-2.5 font-mono shrink-0 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Academic Title & Benchmark Scope */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                Edge AI Digital Twin Workbench
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                SYSTEM ARMED - CONTINUOUS VIBRATION & THERMAL MONITORING
              </span>
            </div>
            <h1 className="text-xs sm:text-sm lg:text-base font-bold text-white tracking-tight font-sans">
              Empirical Cost Modeling of Calibrated Inference Deferral in Microcontroller Edge AI
            </h1>
          </div>
        </div>

        {/* Right: Explicit Hardware Specs & Node Telemetry */}
        <div className="flex flex-wrap items-center gap-3 lg:gap-5 text-[11px] text-gray-400">
          <div className="flex items-center gap-2 bg-[#101622] px-2.5 py-1 rounded-md border border-[#1E293B]">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Node: <strong className="text-gray-100">ESP32-S3 (Dual-Core @ 240MHz)</strong> | Port: <strong className="text-amber-300">COM7</strong> | Baud: <strong className="text-gray-200">115200</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#101622] px-2.5 py-1 rounded-md border border-[#1E293B]">
            <Server className="w-3.5 h-3.5 text-purple-400" />
            <span>
              Cloud Server: <strong className="text-gray-100">Windows LOQ</strong> | GPU: <strong className="text-emerald-400">NVIDIA RTX 3050 (CUDA 12.1)</strong>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
