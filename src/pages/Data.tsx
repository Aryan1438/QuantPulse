import { useRef, useState } from 'react';
import { useApp } from '../state/store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CandlestickChart } from '../components/charts/CandlestickChart';
import { parseOhlcvText } from '../lib/csvParser';
import { candlesToExcelHtml } from '../lib/sampleData';
import type { Timeframe } from '../lib/types';

export function Data() {
  const { datasets, selectedDataset, selectDataset, addDatasetFromCandles } = useApp();
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [assetLabel, setAssetLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDatasetFromCsv = async (path: string, config: { name: string; symbol: string; assetType: string; timeframe: Timeframe; source: string; startDate?: string; endDate?: string }) => {
    setErrors([]);
    setWarnings([]);
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`The dataset at ${path} could not be loaded.`);
      const result = parseOhlcvText(await response.text());
      if (result.errors.length > 0) {
        setErrors(result.errors);
        return;
      }
      setWarnings(result.warnings);
      addDatasetFromCandles(config.name, config.symbol, config.assetType, result.candles, {
        timeframe: config.timeframe,
        source: config.source,
        startDate: config.startDate,
        endDate: config.endDate,
        timezone: 'UTC',
        timeframes: { [config.timeframe]: result.candles },
      });
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'The dataset could not be loaded.']);
    }
  };

  const handleLoadDaily = () => loadDatasetFromCsv('/data/XAUUSD_daily_real.xls', {
    name: 'XAUUSD Daily Historical',
    symbol: 'XAUUSD',
    assetType: 'Commodity',
    timeframe: 'D1',
    source: 'FeziweMelvin/XAUUSD-Gold-Price',
    startDate: '2025-01-01',
    endDate: '2026-09-16',
  });

  const handleLoadXau1h = () => loadDatasetFromCsv('/data/XAUUSD_1H_real.csv', {
    name: 'XAUUSD 1H Historical',
    symbol: 'XAUUSD',
    assetType: 'Commodity',
    timeframe: 'H1',
    source: 'Gianniskas/mt5-m1-bars-us500-eurusd-xauusd',
    startDate: '2025-05-07',
    endDate: '2025-06-05',
  });

  const handleLoadXau4h = () => loadDatasetFromCsv('/data/XAUUSD_4H_real.csv', {
    name: 'XAUUSD 4H Historical',
    symbol: 'XAUUSD',
    assetType: 'Commodity',
    timeframe: 'H4',
    source: 'Gianniskas/mt5-m1-bars-us500-eurusd-xauusd',
    startDate: '2025-01-02',
    endDate: '2026-05-15',
  });

  const handleLoadSbi15m = () => loadDatasetFromCsv('/data/SBIN_15M_real.csv', {
    name: 'SBI 15-Minute Historical',
    symbol: 'SBIN.NS',
    assetType: 'Equity',
    timeframe: 'M15',
    source: 'Yahoo Finance chart API (SBIN.NS)',
    startDate: '2026-09-09',
    endDate: '2026-10-23',
  });

  const handleLoadSbi1h = () => loadDatasetFromCsv('/data/SBIN_1H_real.csv', {
    name: 'SBI 1H Historical',
    symbol: 'SBIN.NS',
    assetType: 'Equity',
    timeframe: 'H1',
    source: 'Yahoo Finance chart API (SBIN.NS)',
    startDate: '2026-09-09',
    endDate: '2026-10-23',
  });

  const handleLoadSbi4h = () => loadDatasetFromCsv('/data/SBIN_4H_real.csv', {
    name: 'SBI 4H Historical',
    symbol: 'SBIN.NS',
    assetType: 'Equity',
    timeframe: 'H4',
    source: 'Yahoo Finance chart API (SBIN.NS)',
    startDate: '2026-09-09',
    endDate: '2026-10-23',
  });

  const handleDownloadRealExcel = () => {
    const source = selectedDataset ?? datasets.find((d) => d.symbol === 'XAUUSD') ?? null;
    const candles = source?.candles ?? [];
    if (!candles.length) {
      setErrors(['Load a real dataset before exporting.']);
      return;
    }
    const blob = new Blob([candlesToExcelHtml(candles)], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${source?.symbol ?? 'XAUUSD'}_${source?.timeframe ?? 'real'}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setErrors([]);
    setWarnings([]);
    if (!/\.(csv|xls)$/i.test(file.name)) {
      setErrors(['Please upload a .csv or .xls file with timestamp, open, high, low, close columns.']);
      return;
    }
    const text = await file.text();
    const result = parseOhlcvText(text);
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    setWarnings(result.warnings);
    const label = assetLabel.trim() || file.name.replace(/\.(csv|xls)$/i, '');
    addDatasetFromCandles(label, label.toUpperCase(), 'Custom', result.candles, { timeframe: 'H1', timezone: 'UTC' });
  };

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6 border-b border-border pb-4">
        <h1 className="text-xl font-bold text-text">Data Management</h1>
        <p className="mt-0.5 text-xs text-muted">Real historical OHLC datasets for backtesting</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-text">Available Datasets</h3>
            <p className="mb-3 mt-0.5 text-xs text-muted">{datasets.length} file(s) loaded</p>

            {datasets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted">
                No datasets loaded
              </div>
            ) : (
              <div className="space-y-2">
                {datasets.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => selectDataset(d.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selectedDataset?.id === d.id ? 'border-accent/40 bg-accent/5' : 'border-border bg-elevated hover:border-border-soft'
                    }`}
                  >
                    <span className="text-accent">▤</span>
                    <div>
                      <div className="text-sm font-medium text-text">{d.name}</div>
                      <div className="text-xs text-muted">
                        {d.candles.length} candles · {d.symbol} · {d.timeframe ?? 'D1'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={handleLoadDaily}>
                ◉ Load Real Daily Data
              </Button>
              <Button variant="secondary" onClick={handleLoadXau1h}>
                ◉ Load XAUUSD 1H Data
              </Button>
              <Button variant="secondary" onClick={handleLoadXau4h}>
                ◉ Load XAUUSD 4H Data
              </Button>
              <Button variant="secondary" onClick={handleLoadSbi15m}>
                ◉ Load SBI 15M Data
              </Button>
              <Button variant="secondary" onClick={handleLoadSbi1h}>
                ◉ Load SBI 1H Data
              </Button>
              <Button variant="secondary" onClick={handleLoadSbi4h}>
                ◉ Load SBI 4H Data
              </Button>
              <button
                onClick={handleDownloadRealExcel}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text transition-colors hover:bg-elevated"
              >
                ↓ Download Real Excel
              </button>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-text">Import New Data</h3>
            <label className="mb-1 block text-xs text-muted">Asset Label (Optional)</label>
            <input
              value={assetLabel}
              onChange={(e) => setAssetLabel(e.target.value)}
              placeholder="e.g. BTC, EURUSD"
              className="mb-3 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent/40 focus:outline-none"
            />

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center"
            >
              <span className="text-2xl text-muted">▤</span>
              <div className="text-sm text-text-dim">
                Drag and drop your CSV file here, or{' '}
                <button className="text-accent hover:underline" onClick={() => fileInputRef.current?.click()}>
                  browse to upload
                </button>
              </div>
              <div className="text-xs text-muted">Required columns: timestamp, open, high, low, close</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            {errors.length > 0 && (
              <div className="mt-3 rounded-lg border border-bearish/30 bg-bearish/10 p-3 text-xs text-bearish">
                {errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-consolidation/30 bg-consolidation/10 p-3 text-xs text-consolidation">
                {warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {!selectedDataset ? (
            <Card className="flex h-130 flex-col items-center justify-center text-center">
              <div className="mb-4 text-3xl text-muted">▧</div>
              <h3 className="text-base font-semibold text-text">No Dataset Selected</h3>
              <p className="mt-2 max-w-sm text-sm text-muted">
                Select a dataset from the list to visualize charts and analyze regimes.
              </p>
            </Card>
          ) : (
            <>
              <Card className="p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border-soft pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-text">{selectedDataset.symbol} {selectedDataset.timeframe ?? 'Daily'} Candlestick Chart</h2>
                    <p className="mt-1 text-xs text-muted">{selectedDataset.source ?? 'Real Historical Data'} · {selectedDataset.candles.length} bars · UTC</p>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-right">
                  <div>
                    <div className="text-xs text-muted">Asset</div>
                    <div className="text-sm font-semibold text-text">{selectedDataset.symbol}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Type</div>
                    <div className="text-sm font-semibold text-text">{selectedDataset.assetType}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Range / Bars</div>
                    <div className="text-sm font-semibold text-text">
                      {new Date(selectedDataset.candles[0].time * 1000).toLocaleDateString()} –{' '}
                      {new Date(selectedDataset.candles[selectedDataset.candles.length - 1].time * 1000).toLocaleDateString()}{' '}
                      ({selectedDataset.candles.length} bars)
                    </div>
                  </div>
                  </div>
                </div>
                <CandlestickChart candles={selectedDataset.candles} height={560} />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
