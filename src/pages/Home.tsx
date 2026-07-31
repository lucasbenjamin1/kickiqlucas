import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall, ApiError } from '../lib/api';
import { formatPercentage, formatMs } from '../lib/utils';

interface AthleteOption {
  id: string;
  first_name: string;
  last_name: string;
  number: string | null;
}

interface LastSession {
  id: string;
  type: string;
  date: string;
  attempts: number;
  makes: number;
  fg_pct: number;
}

interface EstimatedRange {
  distance: number;
  attempts: number;
  makes: number;
  confidence: number;
}

interface BestHash {
  hash: string;
  attempts: number;
  makes: number;
  fg_pct: number;
}

interface MostCommonMiss {
  type: string;
  count: number;
  pct: number;
}

interface Trend {
  direction: 'up' | 'down' | 'flat';
  delta_pct: number;
}

interface DashboardStats {
  athlete_id: string | null;
  season_fg_pct: number;
  season_attempts: number;
  season_makes: number;
  last_30_days_fg_pct: number;
  last_30_days_attempts: number;
  last_30_days_makes: number;
  last_session: LastSession | null;
  estimated_range: EstimatedRange | null;
  best_hash: BestHash | null;
  most_common_miss: MostCommonMiss | null;
  avg_operation_time_ms: number | null;
  trend: Trend;
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
    default: return type;
  }
}

function sessionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    practice: 'Practice',
    game: 'Game',
    pregame: 'Pregame',
    scrimmage: 'Scrimmage',
    tryout: 'Tryout',
    camp: 'Camp',
    other: 'Other',
  };
  return map[type] || type;
}

export default function Home() {
  const navigate = useNavigate();

  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadStats = useCallback(async (athleteId: string | null) => {
    try {
      setLoading(true);
      setError(null);
      const params = athleteId ? `?athlete_id=${athleteId}` : '';
      const data = await apiCall<DashboardStats>(`/api/stats/dashboard${params}`);
      setStats(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAthletes();
  }, [loadAthletes]);

  useEffect(() => {
    if (selectedAthleteId) {
      loadStats(selectedAthleteId);
    }
  }, [selectedAthleteId, loadStats]);

  useEffect(() => {
    if (athletes.length > 0 && selectedAthleteId) {
      loadStats(selectedAthleteId);
    }
  }, [athletes, selectedAthleteId, loadStats]);

  function handleAthleteChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedAthleteId(e.target.value);
  }

  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);

  if (loading && !stats) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 w-48" />
          <div className="h-8 bg-gray-200 w-full" />
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-8 bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      {/* Header + Athlete selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">KickIQ</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">
            {selectedAthlete
              ? `${selectedAthlete.first_name} ${selectedAthlete.last_name}`
              : 'Dashboard'}
          </p>
        </div>
        {athletes.length > 1 && (
          <select
            className="input-field w-auto min-w-[140px] text-sm"
            value={selectedAthleteId}
            onChange={handleAthleteChange}
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

      {/* Error state */}
      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-center">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => loadStats(selectedAthleteId || null)}
            className="btn-secondary text-xs mt-2"
          >
            Retry
          </button>
        </div>
      )}

      {stats && (
        <>
          {/* --- Data Summary Table --- */}
          <div className="table-wrap">
            <div className="table-wrap-inner">
              <table className="data-table">
                <tbody>
                  <tr>
                    <td className="text-gray-500 font-medium">Season FG%</td>
                    <td className="font-mono font-bold text-gray-900">
                      {formatPercentage(stats.season_makes, stats.season_attempts)}
                    </td>
                    <td className="text-xs text-gray-400 font-mono">
                      {stats.season_makes}/{stats.season_attempts}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 font-medium">Last 30 Days</td>
                    <td className="font-mono font-bold text-gray-900">
                      {formatPercentage(stats.last_30_days_makes, stats.last_30_days_attempts)}
                    </td>
                    <td className="text-xs text-gray-400 font-mono">
                      {stats.last_30_days_makes}/{stats.last_30_days_attempts}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 font-medium">Est. Range</td>
                    <td className="font-mono font-bold text-gray-900">
                      {stats.estimated_range ? `${stats.estimated_range.distance} yd` : '--'}
                    </td>
                    <td className="text-xs text-gray-400 font-mono">
                      {stats.estimated_range
                        ? `${stats.estimated_range.makes}/${stats.estimated_range.attempts} (${stats.estimated_range.confidence}%)`
                        : 'Not enough data'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 font-medium">Best Hash</td>
                    <td className="font-mono font-bold text-gray-900">
                      {stats.best_hash ? formatPercentage(stats.best_hash.makes, stats.best_hash.attempts) : '--'}
                    </td>
                    <td className="text-xs text-gray-400 font-mono">
                      {stats.best_hash
                        ? `${hashLabel(stats.best_hash.hash)} (${stats.best_hash.attempts})`
                        : 'No data'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 font-medium">Most Common Miss</td>
                    <td className="font-mono font-bold text-red-600">
                      {stats.most_common_miss ? missTypeLabel(stats.most_common_miss.type) : '--'}
                    </td>
                    <td className="text-xs text-gray-400 font-mono">
                      {stats.most_common_miss
                        ? `${stats.most_common_miss.pct}% of misses`
                        : 'No misses'}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 font-medium">Avg Op Time</td>
                    <td className="font-mono font-bold text-gray-900">
                      {stats.avg_operation_time_ms ? formatMs(stats.avg_operation_time_ms) : '--'}
                    </td>
                    <td className="text-xs text-gray-400 font-mono">Snap to kick</td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 font-medium">Trend (30d)</td>
                    <td className="font-mono font-bold">
                      <span className={
                        stats.trend.direction === 'up'
                          ? 'text-green-600'
                          : stats.trend.direction === 'down'
                            ? 'text-red-600'
                            : 'text-gray-500'
                      }>
                        {stats.trend.direction === 'up' ? '↑' : stats.trend.direction === 'down' ? '↓' : '→'}
                        {stats.trend.direction !== 'flat' && ` ${stats.trend.delta_pct > 0 ? '+' : ''}${stats.trend.delta_pct}%`}
                      </span>
                    </td>
                    <td className="text-xs text-gray-400 font-mono">vs prior 30d</td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 font-medium">Last Session</td>
                    <td className="font-mono font-bold text-gray-900">
                      {stats.last_session
                        ? `${stats.last_session.makes}/${stats.last_session.attempts} (${stats.last_session.fg_pct}%)`
                        : '--'}
                    </td>
                    <td className="text-xs text-gray-400 font-mono">
                      {stats.last_session
                        ? `${sessionTypeLabel(stats.last_session.type)} · ${new Date(stats.last_session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                        : 'No completed sessions'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* --- Quick Actions --- */}
          <div className="space-y-2">
            <button
              onClick={() => {
                if (selectedAthleteId) {
                  apiCall<{ id: string }>('/api/sessions', {
                    method: 'POST',
                    body: JSON.stringify({
                      athlete_id: selectedAthleteId,
                      type: 'practice',
                    }),
                  }).then((data) => {
                    sessionStorage.setItem('kickiq_active_session', data.id);
                    navigate('/record');
                  }).catch(() => {
                    navigate(`/record?athlete=${selectedAthleteId}`);
                  });
                } else {
                  navigate('/record');
                }
              }}
              className="btn-primary w-full text-base font-bold py-3 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
                <circle cx="12" cy="12" r="4" fill="currentColor" />
              </svg>
              New Session
            </button>
            <button
              onClick={() => navigate('/sheets/print')}
              className="btn-secondary w-full text-sm font-semibold py-2.5 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Sheet
            </button>
            <button
              onClick={() => navigate('/sheets/upload')}
              className="btn-secondary w-full text-sm font-semibold py-2.5 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upload Sheet
            </button>
          </div>
        </>
      )}

      {/* Empty state: no athletes */}
      {!loading && !error && !stats && athletes.length === 0 && (
        <div className="border border-gray-200 text-center py-12 px-4">
          <div className="text-gray-400 mb-3">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-600">No athletes yet</p>
            <p className="text-xs mt-1 text-gray-400">Add an athlete to start tracking kicks.</p>
          </div>
          <button
            onClick={() => navigate('/athletes')}
            className="btn-primary text-sm"
          >
            Add Athlete
          </button>
        </div>
      )}
    </div>
  );
}
