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

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  // Load athletes
  const loadAthletes = useCallback(async () => {
    try {
      const data = await apiCall<AthleteOption[]>('/api/athletes');
      setAthletes(data);
      if (data.length > 0 && !selectedAthleteId) {
        setSelectedAthleteId(data[0].id);
      }
    } catch (e) {
      // non-fatal; dashboard still works at team level
    }
  }, []);

  // Load dashboard stats
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

  // On first athlete load, trigger stats load
  useEffect(() => {
    if (athletes.length > 0 && selectedAthleteId) {
      loadStats(selectedAthleteId);
    }
  }, [athletes, selectedAthleteId, loadStats]);

  function handleAthleteChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedAthleteId(e.target.value);
  }

  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);

  // --- Loading skeleton ---
  if (loading && !stats) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-14 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header + Athlete selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-brand-700">KickIQ</h2>
          <p className="text-sm text-gray-500 mt-0.5">
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
          <span className="text-sm text-gray-400">
            {athletes[0].first_name} {athletes[0].last_name}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="card text-center py-3 bg-red-50 border-red-200">
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
          {/* --- Stats Cards Grid --- */}
          <div className="grid grid-cols-2 gap-3">
            {/* Season FG% */}
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Season FG%</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatPercentage(stats.season_makes, stats.season_attempts)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.season_makes}/{stats.season_attempts}
              </p>
            </div>

            {/* Last 30 Days */}
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Last 30 Days</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatPercentage(stats.last_30_days_makes, stats.last_30_days_attempts)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.last_30_days_makes}/{stats.last_30_days_attempts}
              </p>
            </div>

            {/* Estimated Range */}
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Est. Range</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.estimated_range ? `${stats.estimated_range.distance}yd` : '--'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.estimated_range
                  ? `${stats.estimated_range.makes}/${stats.estimated_range.attempts} (${stats.estimated_range.confidence}%)`
                  : 'Not enough data'}
              </p>
            </div>

            {/* Best Hash */}
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Best Hash</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.best_hash ? formatPercentage(stats.best_hash.makes, stats.best_hash.attempts) : '--'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.best_hash
                  ? `${hashLabel(stats.best_hash.hash)} (${stats.best_hash.attempts})`
                  : 'No data'}
              </p>
            </div>

            {/* Most Common Miss */}
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Top Miss</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {stats.most_common_miss ? missTypeLabel(stats.most_common_miss.type) : '--'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.most_common_miss
                  ? `${stats.most_common_miss.pct}% of misses`
                  : 'No misses'}
              </p>
            </div>

            {/* Avg Operation Time */}
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Avg Op Time</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.avg_operation_time_ms ? formatMs(stats.avg_operation_time_ms) : '--'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Snap to kick</p>
            </div>

            {/* Recent Trend */}
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Trend</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-3xl font-bold ${
                  stats.trend.direction === 'up'
                    ? 'text-green-600'
                    : stats.trend.direction === 'down'
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}>
                  {stats.trend.direction === 'up' ? '↑' : stats.trend.direction === 'down' ? '↓' : '→'}
                </span>
                {stats.trend.direction !== 'flat' && (
                  <span className={`text-lg font-semibold ${
                    stats.trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stats.trend.delta_pct > 0 ? '+' : ''}{stats.trend.delta_pct}%
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">30-day comparison</p>
            </div>

            {/* Last Session */}
            <div className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Last Session</p>
              {stats.last_session ? (
                <>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats.last_session.makes}/{stats.last_session.attempts}{' '}
                    <span className="text-lg font-normal text-gray-500">
                      ({stats.last_session.fg_pct}%)
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {sessionTypeLabel(stats.last_session.type)} · {timeAgo(stats.last_session.date)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-400 mt-2 text-sm">No completed sessions</p>
                </>
              )}
            </div>
          </div>

          {/* --- Quick Actions --- */}
          <div className="space-y-3">
            <button
              onClick={() => {
                if (selectedAthleteId) {
                  // Create session instantly and navigate
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
              className="btn-primary w-full text-lg font-bold py-4 flex items-center justify-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
                <circle cx="12" cy="12" r="4" fill="currentColor" />
              </svg>
              New Session
            </button>
            <button
              onClick={() => navigate('/sheets/print')}
              className="btn-secondary w-full text-base font-semibold py-3 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Sheet
            </button>
            <button
              onClick={() => navigate('/sheets/upload')}
              className="btn-secondary w-full text-base font-semibold py-3 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="card text-center py-12">
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
