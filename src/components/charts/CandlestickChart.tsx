import { useEffect, useRef } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  ColorType,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle, RegimeLabel } from '../../lib/types';
import { REGIME_COLOR_HEX } from '../../lib/regime';

interface Props {
  candles: Candle[];
  regimes?: RegimeLabel[];
  height?: number;
}

export function CandlestickChart({ candles, regimes, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#161c26' },
        horzLines: { color: '#161c26' },
      },
      rightPriceScale: { borderColor: '#1d2532' },
      timeScale: { borderColor: '#1d2532', timeVisible: false },
      crosshair: { mode: 0 },
      height,
      width: containerRef.current.clientWidth,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#34d399',
      downColor: '#fb7185',
      borderVisible: false,
      wickUpColor: '#34d399',
      wickDownColor: '#fb7185',
    });

    series.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    if (regimes && regimes.length > 0) {
      createSeriesMarkers(
        series,
        regimes
          .filter((_, i) => i % 40 === 0)
          .map((r) => ({
            time: r.time as UTCTimestamp,
            position: 'aboveBar' as const,
            color: REGIME_COLOR_HEX[r.regime],
            shape: 'circle' as const,
          })),
      );
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, height]);

  return <div ref={containerRef} className="w-full" />;
}
