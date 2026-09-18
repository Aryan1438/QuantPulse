import { useRef, useState } from 'react';
import { useApp, generateSampleDataset } from '../state/store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CandlestickChart } from '../components/charts/CandlestickChart';
import { parseCsvOhlcv } from '../lib/csvParser';
import { candlesToExcelHtml } from '../lib/sampleData';

export function Data() {
  const { datasets, selectedDataset, selectDataset, addDatasetFromCandles } = useApp();
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [assetLabel, setAssetLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadSample = () => {
    const sample = generateSampleDataset();
    addDatasetFromCandles(sample.name, sample.symbol, sample.assetType, sample.candles);
    setErrors([]);
    setWarnings([]);
  };

  const handleDownloadSample = () => {
    const sample = generateSampleDataset();
    const blob = new Blob([candlesToExcelHtml(sample.candles)], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'xauusd-sample-2000-bars.xls';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadAttachedData = async () => {
    setErrors([]);
    setWarnings([]);
    try {
      const response = await fetch('/data/XAUUSD_daily_real.csv');
      if (!response.ok) throw new Error('Attached XAUUSD data could not be loaded.');
      const result = parseCsvOhlcv(await response.text());
      if (result.errors.length > 0) {
        setErrors(result.errors);
        return;
      }
      setWarnings(result.warnings);
      addDatasetFromCandles('XAUUSD Daily Historical', 'XAUUSD', 'Commodity', result.candles);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Attached XAUUSD data could not be loaded.']);
    }
  };

  const handleFile = async (file: File) => {
    setErrors([]);
    setWarnings([]);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrors(['Please upload a .csv file with timestamp, open, high, low, close columns.']);
      return;
    }
    const text = await file.text();
    const result = parseCsvOhlcv(text);
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    setWarnings(result.warnings);
    const label = assetLabel.trim() || file.name.replace(/\.csv$/i, '');
    addDatasetFromCandles(label, label.toUpperCase(), 'Custom', result.candles);
  };

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6 border-b border-border pb-4">
        <h1 className="text-xl font-bold text-text">Data Management</h1>
        <p className="mt-0.5 text-xs text-muted">Upload and manage OHLCV datasets for backtesting</p>
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
                      <div className="text-xs text-muted">{d.candles.length} candles · {d.symbol}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={handleLoadSample}>
                ✦ Load XAUUSD Sample
              </Button>
              <Button variant="outline" onClick={handleDownloadSample}>
                ↓ Download Excel
              </Button>
              <Button variant="primary" onClick={handleLoadAttachedData}>
                ◉ Load Real Daily Data
              </Button>
              <a
                href="/data/XAUUSD_daily_real.xls"
                download
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text transition-colors hover:bg-elevated"
              >
                ↓ Download Real Excel
              </a>
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
                Select a dataset from the list or load sample data to visualize charts and analyze regimes.
              </p>
            </Card>
          ) : (
            <>
              <Card className="p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border-soft pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-text">{selectedDataset.symbol} Daily Candlestick Chart</h2>
                    <p className="mt-1 text-xs text-muted">OHLC price action · {selectedDataset.candles.length} daily bars</p>
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
