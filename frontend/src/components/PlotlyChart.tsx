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
  const dataRef = useRef(data);
  const layoutRef = useRef(layout);
  const configRef = useRef(config);
  const frameIdRef = useRef<number | null>(null);

  dataRef.current = data;
  layoutRef.current = layout;
  configRef.current = config;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (frameIdRef.current !== null) {
      cancelAnimationFrame(frameIdRef.current);
    }

    // Throttle rendering via requestAnimationFrame to screen refresh rate (30-60 FPS)
    frameIdRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const baseLayout: Partial<Plotly.Layout> = {
        uirevision: 'constant',
        autosize: true,
        paper_bgcolor: '#0B0F19',
        plot_bgcolor: '#101622',
        font: {
          family: 'JetBrains Mono, Courier New, monospace',
          color: '#9CA3AF',
          size: 9,
        },
        margin: { l: 45, r: 15, t: 25, b: 25 },
        showlegend: false,
        xaxis: {
          showgrid: true,
          gridcolor: '#1E293B',
          zerolinecolor: '#334155',
          tickcolor: '#475569',
          showline: true,
          linecolor: '#334155',
          ...layoutRef.current.xaxis,
        },
        yaxis: {
          showgrid: true,
          gridcolor: '#1E293B',
          zerolinecolor: '#334155',
          tickcolor: '#475569',
          showline: true,
          linecolor: '#334155',
          ...layoutRef.current.yaxis,
        },
        ...layoutRef.current,
      };

      const baseConfig: Partial<Plotly.Config> = {
        responsive: true,
        displayModeBar: false,
        displaylogo: false,
        staticPlot: false,
        ...configRef.current,
      };

      Plotly.react(containerRef.current, dataRef.current, baseLayout, baseConfig);
    });

    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, [data, layout, config]);

  useEffect(() => {
    const el = containerRef.current;
    const handleResize = () => {
      if (el) Plotly.Plots.resize(el);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (el) {
        try {
          Plotly.purge(el);
        } catch {
          // ignore
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
