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
      paper_bgcolor: '#0B0F19',
      plot_bgcolor: '#101622',
      font: {
        family: 'JetBrains Mono, Courier New, monospace',
        color: '#9CA3AF',
        size: 9,
      },
      margin: { l: 45, r: 15, t: 28, b: 34 },
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.15,
        font: { size: 9, color: '#E2E8F0', family: 'monospace' },
        bgcolor: 'rgba(11, 15, 25, 0.7)',
      },
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

    Plotly.react(el, data, baseLayout, baseConfig);

    const handleResize = () => {
      if (el) Plotly.Plots.resize(el);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, layout, config]);

  return <div ref={containerRef} className={`w-full h-full ${className}`} style={style} />;
};
