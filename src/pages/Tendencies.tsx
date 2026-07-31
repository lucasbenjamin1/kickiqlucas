import { useState, useEffect, useCallback } from 'react';
import { apiCall, ApiError } from '../lib/api';
import { formatPercentage } from '../lib/utils';

interface AthleteOption {
  id: string;
  first_name: string;
  last_name: string;
  number: string | null;
}

interface TendencyStats {
  athlete_name: string;
  team_name: string;
  season_attempts: number;
  season_makes: number;
  season_fg_pct: number;
  by_distance: { distance: number; attempts: number; makes: number; pct: number }[];
  by_hash: { hash: string; attempts: number; makes: number; pct: number }[];
  miss_breakdown: { type: string; count: number; pct: number }[];
  avg_operation_time_ms: number | null;
  total_sessions: number;
  game_kicks: number;
  game_makes: number;
  practice_kicks: number;
  practice_makes: number;
}

function hashLabel(hash: string): string {
  const map: Record<string, string> = {
    left_hash: 'Left Hash',
    left_middle: 'Left Middle',
    middle: 'Middle',
    right_middle: 'Right Middle',
    right_hash: 'Right Hash',
  };
  return map[hash] || hash;
}

function missTypeLabel(type: string): string {
  switch (type) {
    case 'short': return 'Short';
    case 'wide_left': return 'Wide Left';
    case 'wide_right': return 'Wide Right';
    case 'crossbar': return 'Crossbar';
    case 'blocked': return 'Blocked';
    default: return type;
  }
}

export default function Tendencies() {
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [stats, setStats] = useState<TendencyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const loadAthletes = useCallback(async () => {
    try {
      const data = await apiCall<AthleteOption[]>('/api/athletes');
      setAthletes(data);
      if (data.length > 0 && !selectedAthleteId) {
        setSelectedAthleteId(data[0].id);
      }
    } catch {
      // non-fatal
    }
  }, []);

  const loadTendencies = useCallback(async (athleteId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall<TendencyStats>(`/api/stats/tendencies?athlete_id=${athleteId}`);
      setStats(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load tendencies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAthletes();
  }, [loadAthletes]);

  useEffect(() => {
    if (athletes.length > 0 && selectedAthleteId) {
      loadTendencies(selectedAthleteId);
    }
  }, [athletes, selectedAthleteId, loadTendencies]);

  function generateReport() {
    if (!stats) return;
    setGeneratingReport(true);

    const rows: string[] = [];
    rows.push(`<html><head><meta charset="utf-8"><title>KickIQ Report - ${stats.athlete_name}</title>`);
    rows.push(`<style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 700px; margin: 0 auto; padding: 20px; }
      h1 { color: #c41e3a; font-size: 22px; margin-bottom: 4px; }
      h2 { color: #333; font-size: 16px; margin: 20px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
      .subtitle { color: #666; font-size: 13px; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 13px; }
      th { background: #f5f5f5; text-align: left; padding: 6px 8px; font-weight: 600; border-bottom: 2px solid #ddd; }
      td { padding: 5px 8px; border-bottom: 1px solid #eee; }
      .stat-row { display: flex; gap: 16px; flex-wrap: wrap; margin: 8px 0; }
      .stat-box { background: #f9fafb; border-radius: 8px; padding: 12px 16px; min-width: 120px; }
      .stat-value { font-size: 24px; font-weight: 700; }
      .stat-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
      .footer { margin-top: 24px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
      @media print { body { padding: 0; } }
    </style></head><body>`);

    rows.push(`<h1>KickIQ Performance Report</h1>`);
    rows.push(`<p class="subtitle">${stats.athlete_name} — ${stats.team_name}</p>`);
    rows.push(`<p class="subtitle">${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>`);

    // Summary stats
    rows.push(`<h2>Overview</h2>`);
    rows.push(`<div class="stat-row">`);
    rows.push(`<div class="stat-box"><div class="stat-value">${formatPercentage(stats.season_makes, stats.season_attempts)}</div><div class="stat-label">Season FG%</div></div>`);
    rows.push(`<div class="stat-box"><div class="stat-value">${stats.season_makes}/${stats.season_attempts}</div><div class="stat-label">Made/Attempts</div></div>`);
    rows.push(`<div class="stat-box"><div class="stat-value">${stats.total_sessions}</div><div class="stat-label">Sessions</div></div>`);
    if (stats.avg_operation_time_ms) {
      rows.push(`<div class="stat-box"><div class="stat-value">${stats.avg_operation_time_ms}ms</div><div class="stat-label">Avg Op Time</div></div>`);
    }
    rows.push(`</div>`);

    // Practice vs Game
    rows.push(`<h2>Practice vs Game</h2>`);
    const practicePct = stats.practice_kicks > 0 ? Math.round((stats.practice_makes / stats.practice_kicks) * 100) : 0;
    const gamePct = stats.game_kicks > 0 ? Math.round((stats.game_makes / stats.game_kicks) * 100) : 0;
    rows.push(`<table><tr><th></th><th>Attempts</th><th>Made</th><th>FG%</th></tr>`);
    rows.push(`<tr><td>Practice</td><td>${stats.practice_kicks}</td><td>${stats.practice_makes}</td><td>${practicePct}%</td></tr>`);
    rows.push(`<tr><td>Game</td><td>${stats.game_kicks}</td><td>${stats.game_makes}</td><td>${gamePct}%</td></tr>`);
    rows.push(`</table>`);

    // FG% by distance
    rows.push(`<h2>FG% by Distance</h2>`);
    rows.push(`<table><tr><th>Distance</th><th>Attempts</th><th>Made</th><th>FG%</th></tr>`);
    if (stats.by_distance.length === 0) {
      rows.push(`<tr><td colspan="4">No data</td></tr>`);
    } else {
      for (const d of stats.by_distance) {
        rows.push(`<tr><td>${d.distance} yds</td><td>${d.attempts}</td><td>${d.makes}</td><td>${d.pct}%</td></tr>`);
      }
    }
    rows.push(`</table>`);

    // FG% by hash
    rows.push(`<h2>FG% by Hash</h2>`);
    rows.push(`<table><tr><th>Hash</th><th>Attempts</th><th>Made</th><th>FG%</th></tr>`);
    if (stats.by_hash.length === 0) {
      rows.push(`<tr><td colspan="4">No data</td></tr>`);
    } else {
      for (const h of stats.by_hash) {
        rows.push(`<tr><td>${hashLabel(h.hash)}</td><td>${h.attempts}</td><td>${h.makes}</td><td>${h.pct}%</td></tr>`);
      }
    }
    rows.push(`</table>`);

    // Miss direction breakdown
    rows.push(`<h2>Miss Direction Breakdown</h2>`);
    rows.push(`<table><tr><th>Miss Type</th><th>Count</th><th>% of Misses</th></tr>`);
    if (stats.miss_breakdown.length === 0) {
      rows.push(`<tr><td colspan="3">No misses recorded</td></tr>`);
    } else {
      for (const m of stats.miss_breakdown) {
        rows.push(`<tr><td>${missTypeLabel(m.type)}</td><td>${m.count}</td><td>${m.pct}%</td></tr>`);
      }
    }
    rows.push(`</table>`);

    rows.push(`<div class="footer">Generated by KickIQ · ${new Date().toISOString().split('T')[0]}</div>`);
    rows.push(`</body></html>`);

    const html = rows.join('\n');
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    // Open in new tab for printing
    const w = window.open(url, '_blank');
    if (w) {
      w.onload = () => {
        setGeneratingReport(false);
      };
      // Fallback: reset after 2s
      setTimeout(() => setGeneratingReport(false), 2000);
    } else {
      // Fallback: trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `kickiq-report-${stats.athlete_name.replace(/\s+/g, '-').toLowerCase()}.html`;
      a.click();
      setGeneratingReport(false);
    }
  }

  if (loading && !stats) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-36" />
          <div className="h-4 bg-gray-200 rounded w-64" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tendencies</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedAthlete
              ? `${selectedAthlete.first_name} ${selectedAthlete.last_name}`
              : 'Select an athlete'}
          </p>
        </div>
        {athletes.length > 1 && (
          <select
            className="input-field w-auto min-w-[140px] text-sm"
            value={selectedAthleteId}
            onChange={(e) => setSelectedAthleteId(e.target.value)}
          >
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.first_name} {a.last_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="card text-center py-3 bg-red-50 border-red-200">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => selectedAthleteId && loadTendencies(selectedAthleteId)}
            className="btn-secondary text-xs mt-2"
          >
            Retry
          </button>
        </div>
      )}

      {stats && (
        <>
          {/* Generate Report Button */}
          <button
            onClick={generateReport}
            disabled={generatingReport}
            className="btn-secondary w-full text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {generatingReport ? 'Opening Report...' : 'Generate Report'}
          </button>

          {/* Overview Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Season FG%</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatPercentage(stats.season_makes, stats.season_attempts)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{stats.season_makes}/{stats.season_attempts}</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Sessions</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total_sessions}</p>
              <p className="text-xs text-gray-400 mt-0.5">All time</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Practice</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatPercentage(stats.practice_makes, stats.practice_kicks)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{stats.practice_makes}/{stats.practice_kicks}</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Game</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatPercentage(stats.game_makes, stats.game_kicks)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{stats.game_makes}/{stats.game_kicks}</p>
            </div>
            {stats.avg_operation_time_ms && (
              <div className="card col-span-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Avg Operation Time</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.avg_operation_time_ms}ms</p>
                <p className="text-xs text-gray-400 mt-0.5">Snap to kick</p>
              </div>
            )}
          </div>

          {/* FG% by Distance */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">FG% by Distance</h3>
            {stats.by_distance.length === 0 ? (
              <p className="text-sm text-gray-400">No data</p>
            ) : (
              <div className="space-y-1.5">
                {stats.by_distance.map((d) => (
                  <div key={d.distance} className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-gray-700 w-16">{d.distance} yds</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-700 rounded-full transition-all"
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono font-bold text-gray-900 w-12 text-right">{d.pct}%</span>
                    <span className="text-xs text-gray-400 w-16 text-right">{d.makes}/{d.attempts}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FG% by Hash */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">FG% by Hash</h3>
            {stats.by_hash.length === 0 ? (
              <p className="text-sm text-gray-400">No data</p>
            ) : (
              <div className="space-y-1.5">
                {stats.by_hash.map((h) => (
                  <div key={h.hash} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 w-20">{hashLabel(h.hash)}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-700 rounded-full transition-all"
                        style={{ width: `${h.pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono font-bold text-gray-900 w-12 text-right">{h.pct}%</span>
                    <span className="text-xs text-gray-400 w-16 text-right">{h.makes}/{h.attempts}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Miss Direction Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Miss Direction</h3>
            {stats.miss_breakdown.length === 0 ? (
              <p className="text-sm text-gray-400">No misses recorded</p>
            ) : (
              <div className="space-y-1.5">
                {stats.miss_breakdown.map((m) => (
                  <div key={m.type} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-red-600 w-24">{missTypeLabel(m.type)}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all"
                        style={{ width: `${m.pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono font-bold text-gray-900 w-12 text-right">{m.pct}%</span>
                    <span className="text-xs text-gray-400 w-8 text-right">{m.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !error && !stats && athletes.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-sm text-gray-500">No athletes found. Add an athlete first.</p>
        </div>
      )}
    </div>
  );
}
