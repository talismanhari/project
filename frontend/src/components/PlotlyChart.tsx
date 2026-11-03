import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

interface PlotlyChartProps {
  data: Plotly.Data[];
  layout?: Partial<Plotly.Layout>;
  config?: Partial<Plotly.Config>;
  className?: string;
  style?: React.CSSProperties;
}

export const PlotlyChart: React.FC<PlotlyChartProps> = ({
  data,
  layout = {},
  config = {},
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const baseLayout: Partial<Plotly.Layout> = {
      uirevision: 'SCADA_LOCKED',
      autosize: true,
      paper_bgcolor: '#0B0F19',
      plot_bgcolor: '#101622',
      font: {
        family: 'JetBrains Mono, Courier New, monospace',
        color: '#9CA3AF',
        size: 9,
      },
      margin: { l: 45, r: 15, t: 28, b: 34 },
      showlegend: false,
      xaxis: {
        showgrid: true,
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
        tickcolor: '#475569',
        showline: true,
        linecolor: '#334155',
        ticks: 'outside',
        ...layout.xaxis,
      },
      yaxis: {
        showgrid: true,
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
        tickcolor: '#475569',
        showline: true,
        linecolor: '#334155',
        ticks: 'outside',
        ...layout.yaxis,
      },
      ...layout,
    };

    const baseConfig: Partial<Plotly.Config> = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false,
      ...config,
    };

    // Decouple rendering from synchronous React DOM tree updates to eliminate scroll jitter
    const rafId = requestAnimationFrame(() => {
      if (containerRef.current) {
        Plotly.react(containerRef.current, data, baseLayout, baseConfig);
      }
    });

    const handleResize = () => {
      if (containerRef.current) {
        Plotly.Plots.resize(containerRef.current);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [data, layout, config]);

  // Safe purge when unmounting
  useEffect(() => {
    const el = containerRef.current;
    return () => {
      if (el) {
        try {
          Plotly.purge(el);
        } catch {
          // ignore purge on unmount
        }
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden ${className}`}
      style={style}
    />
  );
};

export default PlotlyChart;
