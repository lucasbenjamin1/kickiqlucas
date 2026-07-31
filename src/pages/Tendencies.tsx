import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiCall, ApiError } from '../lib/api';
import { formatPercentage, formatMs } from '../lib/utils';

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

interface RawKick {
  id: string;
  distance: number;
  hash: string;
  result: string;
  miss_type: string | null;
  landing_zone: string | null;
  operation_time_ms: number | null;
  notes: string | null;
  created_at: string;
  source_type: string | null;
  session_type: string;
  session_date: string;
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

function sessionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    practice: 'Prac',
    game: 'Game',
    pregame: 'Pre',
    scrimmage: 'Scrim',
    tryout: 'Try',
    camp: 'Camp',
    other: 'Oth',
  };
  return map[type] || type;
}

type KickSortKey = 'date' | 'distance' | 'hash' | 'result' | 'type' | 'optime';

export default function Tendencies() {
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [stats, setStats] = useState<TendencyStats | null>(null);
  const [rawKicks, setRawKicks] = useState<RawKick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [kickSortKey, setKickSortKey] = useState<KickSortKey>('date');
  const [kickSortDir, setKickSortDir] = useState<'asc' | 'desc'>('desc');

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
      // Also load raw kicks
      const kicksData = await apiCall<RawKick[]>(`/api/kicks?athlete_id=${athleteId}`);
      setRawKicks(kicksData);
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

  const handleKickSort = (key: KickSortKey) => {
    if (kickSortKey === key) {
      setKickSortDir(kickSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setKickSortKey(key);
      setKickSortDir('desc');
    }
  };

  const sortedKicks = useMemo(() => {
    const sorted = [...rawKicks];
    const dir = kickSortDir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      switch (kickSortKey) {
        case 'date':
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'distance':
          return dir * (a.distance - b.distance);
        case 'hash':
          return dir * a.hash.localeCompare(b.hash);
        case 'result':
          return dir * a.result.localeCompare(b.result);
        case 'type':
          return dir * a.session_type.localeCompare(b.session_type);
        case 'optime': {
          const oa = a.operation_time_ms ?? -1;
          const ob = b.operation_time_ms ?? -1;
          return dir * (oa - ob);
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [rawKicks, kickSortKey, kickSortDir]);

  const KickSortIcon = ({ col }: { col: KickSortKey }) => {
    if (kickSortKey !== col) return <span className="text-gray-300 ml-0.5">↕</span>;
    return <span className="text-brand-700 ml-0.5">{kickSortDir === 'asc' ? '↑' : '↓'}</span>;
  };

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
      .stat-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px 16px; min-width: 120px; }
      .stat-value { font-size: 24px; font-weight: 700; }
      .stat-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
      .footer { margin-top: 24px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
      @media print { body { padding: 0; } }
    </style></head><body>`);

    rows.push(`<h1>KickIQ Performance Report</h1>`);
    rows.push(`<p class="subtitle">${stats.athlete_name} — ${stats.team_name}</p>`);
    rows.push(`<p class="subtitle">${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>`);

    rows.push(`<h2>Overview</h2>`);
    rows.push(`<div class="stat-row">`);
    rows.push(`<div class="stat-box"><div class="stat-value">${formatPercentage(stats.season_makes, stats.season_attempts)}</div><div class="stat-label">Season FG%</div></div>`);
    rows.push(`<div class="stat-box"><div class="stat-value">${stats.season_makes}/${stats.season_attempts}</div><div class="stat-label">Made/Attempts</div></div>`);
    rows.push(`<div class="stat-box"><div class="stat-value">${stats.total_sessions}</div><div class="stat-label">Sessions</div></div>`);
    if (stats.avg_operation_time_ms) {
      rows.push(`<div class="stat-box"><div class="stat-value">${stats.avg_operation_time_ms}ms</div><div class="stat-label">Avg Op Time</div></div>`);
    }
    rows.push(`</div>`);

    rows.push(`<h2>Practice vs Game</h2>`);
    const practicePct = stats.practice_kicks > 0 ? Math.round((stats.practice_makes / stats.practice_kicks) * 100) : 0;
    const gamePct = stats.game_kicks > 0 ? Math.round((stats.game_makes / stats.game_kicks) * 100) : 0;
    rows.push(`<table><tr><th></th><th>Attempts</th><th>Made</th><th>FG%</th></tr>`);
    rows.push(`<tr><td>Practice</td><td>${stats.practice_kicks}</td><td>${stats.practice_makes}</td><td>${practicePct}%</td></tr>`);
    rows.push(`<tr><td>Game</td><td>${stats.game_kicks}</td><td>${stats.game_makes}</td><td>${gamePct}%</td></tr>`);
    rows.push(`</table>`);

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

    const w = window.open(url, '_blank');
    if (w) {
      w.onload = () => setGeneratingReport(false);
      setTimeout(() => setGeneratingReport(false), 2000);
    } else {
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
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 w-36" />
          <div className="h-4 bg-gray-200 w-64" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100" />
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
          <h2 className="text-lg font-bold text-gray-900">Tendencies</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">
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
        {athletes.length === 1 && (
          <span className="text-xs text-gray-400 font-mono">
            {athletes[0].first_name} {athletes[0].last_name}
          </span>
        )}
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-center">
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
          {/* Generate Report Button — prominent */}
          <button
            onClick={generateReport}
            disabled={generatingReport}
            className="btn-primary w-full text-base font-bold py-3 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {generatingReport ? 'Opening Report...' : 'Generate Report'}
          </button>

          {/* Overview Data Table */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Overview</h3>
            <div className="table-wrap">
              <div className="table-wrap-inner">
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td className="text-gray-500 font-medium">Season FG%</td>
                      <td className="font-mono font-bold">{formatPercentage(stats.season_makes, stats.season_attempts)}</td>
                      <td className="text-xs text-gray-400 font-mono">{stats.season_makes}/{stats.season_attempts}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-500 font-medium">Total Sessions</td>
                      <td className="font-mono font-bold">{stats.total_sessions}</td>
                      <td className="text-xs text-gray-400 font-mono">All time</td>
                    </tr>
                    <tr>
                      <td className="text-gray-500 font-medium">Practice FG%</td>
                      <td className="font-mono font-bold">{formatPercentage(stats.practice_makes, stats.practice_kicks)}</td>
                      <td className="text-xs text-gray-400 font-mono">{stats.practice_makes}/{stats.practice_kicks}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-500 font-medium">Game FG%</td>
                      <td className="font-mono font-bold">{formatPercentage(stats.game_makes, stats.game_kicks)}</td>
                      <td className="text-xs text-gray-400 font-mono">{stats.game_makes}/{stats.game_kicks}</td>
                    </tr>
                    {stats.avg_operation_time_ms && (
                      <tr>
                        <td className="text-gray-500 font-medium">Avg Op Time</td>
                        <td className="font-mono font-bold">{stats.avg_operation_time_ms}ms</td>
                        <td className="text-xs text-gray-400 font-mono">Snap to kick</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* FG% by Distance */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">FG% by Distance</h3>
            {stats.by_distance.length === 0 ? (
              <p className="text-sm text-gray-400">No data</p>
            ) : (
              <div className="table-wrap">
                <div className="table-wrap-inner">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Distance</th>
                        <th>Attempts</th>
                        <th>Made</th>
                        <th>FG%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.by_distance.map((d) => (
                        <tr key={d.distance}>
                          <td className="font-mono font-bold">{d.distance} yd</td>
                          <td className="font-mono">{d.attempts}</td>
                          <td className="font-mono">{d.makes}</td>
                          <td className="font-mono font-bold">{d.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* FG% by Hash */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">FG% by Hash</h3>
            {stats.by_hash.length === 0 ? (
              <p className="text-sm text-gray-400">No data</p>
            ) : (
              <div className="table-wrap">
                <div className="table-wrap-inner">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Hash</th>
                        <th>Attempts</th>
                        <th>Made</th>
                        <th>FG%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.by_hash.map((h) => (
                        <tr key={h.hash}>
                          <td className="font-medium">{hashLabel(h.hash)}</td>
                          <td className="font-mono">{h.attempts}</td>
                          <td className="font-mono">{h.makes}</td>
                          <td className="font-mono font-bold">{h.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Miss Direction */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Miss Direction</h3>
            {stats.miss_breakdown.length === 0 ? (
              <p className="text-sm text-gray-400">No misses recorded</p>
            ) : (
              <div className="table-wrap">
                <div className="table-wrap-inner">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Miss Type</th>
                        <th>Count</th>
                        <th>% of Misses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.miss_breakdown.map((m) => (
                        <tr key={m.type}>
                          <td className="font-medium text-red-600">{missTypeLabel(m.type)}</td>
                          <td className="font-mono">{m.count}</td>
                          <td className="font-mono font-bold">{m.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Raw Kicks Data Table */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              All Kicks ({rawKicks.length})
            </h3>
            {rawKicks.length === 0 ? (
              <p className="text-sm text-gray-400">No kicks recorded</p>
            ) : (
              <div className="table-wrap">
                <div className="table-wrap-inner">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th onClick={() => handleKickSort('date')} className={kickSortKey === 'date' ? 'sorted' : ''}>
                          Date<KickSortIcon col="date" />
                        </th>
                        <th onClick={() => handleKickSort('type')} className={kickSortKey === 'type' ? 'sorted' : ''}>
                          Type<KickSortIcon col="type" />
                        </th>
                        <th onClick={() => handleKickSort('distance')} className={kickSortKey === 'distance' ? 'sorted' : ''}>
                          Dist<KickSortIcon col="distance" />
                        </th>
                        <th onClick={() => handleKickSort('hash')} className={kickSortKey === 'hash' ? 'sorted' : ''}>
                          Hash<KickSortIcon col="hash" />
                        </th>
                        <th onClick={() => handleKickSort('result')} className={kickSortKey === 'result' ? 'sorted' : ''}>
                          Result<KickSortIcon col="result" />
                        </th>
                        <th onClick={() => handleKickSort('optime')} className={kickSortKey === 'optime' ? 'sorted' : ''}>
                          Time<KickSortIcon col="optime" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedKicks.map((k) => (
                        <tr key={k.id}>
                          <td className="text-xs whitespace-nowrap">
                            {new Date(k.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="text-xs">
                            <span className="px-1 py-0.5 border border-gray-200 text-gray-500">
                              {sessionTypeLabel(k.session_type)}
                            </span>
                          </td>
                          <td className="font-mono font-bold">{k.distance}</td>
                          <td className="text-xs">{hashLabel(k.hash)}</td>
                          <td>
                            <span className={`text-xs font-medium ${k.result === 'made' ? 'text-green-700' : k.result === 'blocked' ? 'text-yellow-700' : 'text-red-600'}`}>
                              {k.result === 'made' ? 'Made' : k.result === 'blocked' ? 'Block' : 'Miss'}
                              {k.miss_type && k.result !== 'made' && (
                                <span className="text-gray-400 ml-1">({missTypeLabel(k.miss_type)})</span>
                              )}
                            </span>
                          </td>
                          <td className="font-mono text-xs">
                            {k.operation_time_ms ? formatMs(k.operation_time_ms) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !error && !stats && athletes.length === 0 && (
        <div className="border border-gray-200 text-center py-12 px-4">
          <p className="text-sm text-gray-500">No athletes found. Add an athlete first.</p>
        </div>
      )}
    </div>
  );
}
