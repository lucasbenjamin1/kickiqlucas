import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiCall, ApiError } from '../lib/api';
import { formatMs } from '../lib/utils';

interface Kick {
  id: string;
  distance: number;
  hash: 'left' | 'center' | 'right';
  result: 'made' | 'missed' | 'blocked';
  miss_type: 'short' | 'wide_left' | 'wide_right' | 'crossbar' | 'blocked' | null;
  landing_zone: 'goalpost' | 'left' | 'right' | 'short' | null;
  operation_time_ms: number | null;
  notes: string | null;
  created_at: string;
}

interface Session {
  id: string;
  type: string;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  athlete_id: string;
  first_name: string;
  last_name: string;
  number: string | null;
  kick_count: number;
  kicks: Kick[];
}

const SESSION_TYPES: Record<string, string> = {
  practice: 'Practice',
  game: 'Game',
  pregame: 'Pregame',
  scrimmage: 'Scrimmage',
  tryout: 'Tryout',
  camp: 'Camp',
  other: 'Other',
};

function typeBadgeColor(type: string): string {
  switch (type) {
    case 'game': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'practice': return 'bg-green-50 text-green-700 border-green-200';
    case 'pregame': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function hashLabel(h: string): string {
  return h === 'left' ? 'L' : h === 'center' ? 'M' : 'R';
}

function resultLabel(r: string): string {
  return r === 'made' ? 'Made' : r === 'missed' ? 'Missed' : 'Blocked';
}

function missTypeLabel(mt: string): string {
  switch (mt) {
    case 'short': return 'Short';
    case 'wide_left': return 'Wide Left';
    case 'wide_right': return 'Wide Right';
    case 'crossbar': return 'Crossbar';
    case 'blocked': return 'Blocked';
    default: return mt;
  }
}

function landingZoneLabel(lz: string): string {
  switch (lz) {
    case 'goalpost': return 'Goalpost';
    case 'left': return 'Left';
    case 'right': return 'Right';
    case 'short': return 'Short';
    default: return lz;
  }
}

// Deterministic seeded random for stable scatter positions
function seededRandom(seed: number): number {
  let s = seed;
  s = (s * 1664525 + 1013904223) & 0xffffffff;
  return (s >>> 0) / 0xffffffff;
}

// Compute stable plot position for a kick
function kickPlotPosition(kick: Kick, index: number): { x: number; y: number } {
  const seedBase = index * 7 + kick.distance * 13 + kick.hash.charCodeAt(0) * 3;
  const rng = (offset: number) => seededRandom(seedBase + offset);

  // Goalpost geometry in SVG coords (viewBox 0 0 300 340)
  const leftPost = 95;
  const rightPost = 205;
  const crossbarY = 180;
  const topY = 80;
  const bottomY = 250;

  if (kick.result === 'made') {
    // Made: inside/above crossbar area, spread within uprights
    const x = leftPost + 5 + rng(1) * (rightPost - leftPost - 10);
    // Shorter kicks plot lower (closer to crossbar), longer kicks higher
    const heightFactor = Math.min((kick.distance - 15) / 50, 1); // normalize 15-65yd
    const y = crossbarY - 5 - rng(2) * 80 * heightFactor;
    return { x, y: Math.max(topY, y) };
  }

  if (kick.result === 'blocked') {
    // Blocked: near/at the line of scrimmage (bottom)
    const x = leftPost + 10 + rng(1) * (rightPost - leftPost - 20);
    const y = bottomY - 30 + rng(2) * 15;
    return { x, y };
  }

  // Missed
  const mt = kick.miss_type;
  if (mt === 'wide_left') {
    const x = 15 + rng(1) * 65;
    const y = topY + rng(2) * 90;
    return { x, y };
  }
  if (mt === 'wide_right') {
    const x = 215 + rng(1) * 70;
    const y = topY + rng(2) * 90;
    return { x, y };
  }
  if (mt === 'short') {
    const x = leftPost + 10 + rng(1) * (rightPost - leftPost - 20);
    const y = crossbarY + 5 + rng(2) * 50;
    return { x, y: Math.min(y, bottomY - 5) };
  }
  // fallback for missed without type
  const x = leftPost + 10 + rng(1) * (rightPost - leftPost - 20);
  const y = crossbarY + 5 + rng(2) * 50;
  return { x, y: Math.min(y, bottomY - 5) };
}

function dotColor(kick: Kick): string {
  if (kick.result === 'made') return '#16a34a'; // green-600
  if (kick.result === 'blocked') return '#f97316'; // orange-500
  return '#dc2626'; // red-600
}

// ---- Goalpost SVG Component ----
function GoalpostSVG({ kicks }: { kicks: Kick[] }) {
  const [selectedKick, setSelectedKick] = useState<Kick | null>(null);

  const leftPost = 95;
  const rightPost = 205;
  const crossbarY = 180;
  const postTop = 60;
  const postBottom = 255;
  const groundY = 260;
  const dotRadius = 7;

  return (
    <div className="relative">
      <svg viewBox="0 0 300 340" className="w-full max-w-[320px] mx-auto" role="img" aria-label="Goalpost scatter plot">
        {/* Background field */}
        <rect x={0} y={0} width={300} height={340} fill="#f8fafc" rx={12} />

        {/* Ground line */}
        <line x1={20} y1={groundY} x2={280} y2={groundY} stroke="#94a3b8" strokeWidth={2} />

        {/* Uprights */}
        <line x1={leftPost} y1={postTop} x2={leftPost} y2={postBottom} stroke="#94a3b8" strokeWidth={4} strokeLinecap="round" />
        <line x1={rightPost} y1={postTop} x2={rightPost} y2={postBottom} stroke="#94a3b8" strokeWidth={4} strokeLinecap="round" />

        {/* Crossbar */}
        <line x1={leftPost - 5} y1={crossbarY} x2={rightPost + 5} y2={crossbarY} stroke="#94a3b8" strokeWidth={4} strokeLinecap="round" />

        {/* Post tops (short horizontal caps) */}
        <line x1={leftPost - 8} y1={postTop} x2={leftPost + 8} y2={postTop} stroke="#94a3b8" strokeWidth={4} strokeLinecap="round" />
        <line x1={rightPost - 8} y1={postTop} x2={rightPost + 8} y2={postTop} stroke="#94a3b8" strokeWidth={4} strokeLinecap="round" />

        {/* Kick dots */}
        {kicks.map((kick, i) => {
          const pos = kickPlotPosition(kick, i);
          const isSelected = selectedKick?.id === kick.id;
          return (
            <g key={kick.id} onClick={() => setSelectedKick(isSelected ? null : kick)} className="cursor-pointer">
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isSelected ? dotRadius + 2 : dotRadius}
                fill={dotColor(kick)}
                fillOpacity={isSelected ? 1 : 0.85}
                stroke={isSelected ? '#1a1a1a' : 'none'}
                strokeWidth={isSelected ? 2 : 0}
              />
              {isSelected && (
                <circle cx={pos.x} cy={pos.y} r={dotRadius + 5} fill="none" stroke="#1a1a1a" strokeWidth={1} opacity={0.3} />
              )}
            </g>
          );
        })}

        {/* Yard markers */}
        <text x={288} y={crossbarY - 1} textAnchor="start" className="text-[9px] fill-slate-400" fontFamily="system-ui">FG</text>
        <text x={288} y={groundY - 3} textAnchor="start" className="text-[9px] fill-slate-400" fontFamily="system-ui">LOS</text>

        {/* Distance labels */}
        {kicks.length > 0 && (
          <g>
            <text x={150} y={295} textAnchor="middle" className="text-[10px] fill-slate-500" fontFamily="system-ui">
              ● Made &nbsp; ● Missed &nbsp; ● Blocked
            </text>
          </g>
        )}
      </svg>

      {/* Tooltip for selected kick */}
      {selectedKick && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap z-10">
          <div className="font-bold">{selectedKick.distance}yd {hashLabel(selectedKick.hash)} — {resultLabel(selectedKick.result)}</div>
          {selectedKick.miss_type && (
            <div className="text-gray-300 mt-0.5">Miss: {missTypeLabel(selectedKick.miss_type)}</div>
          )}
          {selectedKick.landing_zone && (
            <div className="text-gray-300">Landing: {landingZoneLabel(selectedKick.landing_zone)}</div>
          )}
          {selectedKick.operation_time_ms && (
            <div className="text-gray-300">Op: {formatMs(selectedKick.operation_time_ms)}</div>
          )}
          <button
            onClick={() => setSelectedKick(null)}
            className="absolute -top-1 -right-1 w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center text-[10px]"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Stat Card ----
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
      <div className="text-2xl font-mono font-bold text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ---- Main Component ----
export default function SessionSummary() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKick, setExpandedKick] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall<Session>(`/api/sessions/${id}`);
      setSession(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-36" />
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="h-4 bg-gray-200 rounded w-64" />
          <div className="h-32 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto text-center">
        <p className="text-red-600 text-sm">{error || 'Session not found'}</p>
        <button onClick={loadSession} className="btn-secondary text-sm mt-3">Retry</button>
        <Link to="/sessions" className="btn-primary text-sm mt-3 ml-2 inline-block">Back to Sessions</Link>
      </div>
    );
  }

  const kicks: Kick[] = session.kicks || [];
  const totalKicks = kicks.length;
  const makes = kicks.filter(k => k.result === 'made').length;
  const misses = kicks.filter(k => k.result === 'missed').length;
  const blocked = kicks.filter(k => k.result === 'blocked').length;
  const pct = totalKicks > 0 ? Math.round((makes / totalKicks) * 100) : 0;

  const distances = kicks.map(k => k.distance);
  const avgDistance = distances.length > 0
    ? (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(1)
    : '--';
  const longestMake = kicks
    .filter(k => k.result === 'made')
    .reduce((max, k) => Math.max(max, k.distance), 0) || '--';

  const opTimes = kicks
    .filter(k => k.operation_time_ms != null)
    .map(k => k.operation_time_ms!);
  const avgOpTime = opTimes.length > 0
    ? Math.round(opTimes.reduce((a, b) => a + b, 0) / opTimes.length)
    : null;

  return (
    <div className="px-4 py-4 max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/sessions')}
          className="min-h-touch min-w-touch flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-lg"
          aria-label="Back to sessions"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900 truncate">
            {session.first_name} {session.last_name}
            {session.number && <span className="text-sm font-normal text-gray-400 ml-1">#{session.number}</span>}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${typeBadgeColor(session.type)}`}>
              {SESSION_TYPES[session.type] || session.type}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(session.started_at).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="Attempts" value={String(totalKicks)} />
        <StatCard label="Makes" value={String(makes)} />
        <StatCard label="FG%" value={`${pct}%`} sub={`${makes}/${totalKicks}`} />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="Avg Distance" value={typeof avgDistance === 'string' ? avgDistance : `${avgDistance}yd`} />
        <StatCard label="Longest Make" value={typeof longestMake === 'string' ? longestMake : `${longestMake}yd`} />
        <StatCard
          label="Avg Op Time"
          value={avgOpTime ? formatMs(avgOpTime) : '--'}
        />
      </div>

      {/* Miss/Block summary */}
      {(misses > 0 || blocked > 0) && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {['wide_left', 'wide_right', 'short'].map(mt => {
            const count = kicks.filter(k => k.miss_type === mt).length;
            if (count === 0) return null;
            return (
              <span key={mt} className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                {missTypeLabel(mt)}: {count}
              </span>
            );
          })}
          {blocked > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
              Blocked: {blocked}
            </span>
          )}
        </div>
      )}

      {/* Goalpost Scatter Plot */}
      {totalKicks > 0 ? (
        <div className="card mb-4 p-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">Kick Chart</h3>
          <GoalpostSVG kicks={kicks} />
        </div>
      ) : (
        <div className="card mb-4 text-center py-8 text-gray-400 text-sm">
          No kicks recorded in this session.
        </div>
      )}

      {/* Kick List */}
      {totalKicks > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">All Kicks ({totalKicks})</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {/* Header row */}
            <div className="flex items-center px-4 py-2 text-[10px] uppercase tracking-wider text-gray-400 font-medium">
              <span className="w-6">#</span>
              <span className="w-12 text-right">Dist</span>
              <span className="w-8 text-center">Hash</span>
              <span className="flex-1 text-center">Result</span>
              <span className="w-14 text-right">Op</span>
            </div>
            {kicks.map((kick, i) => {
              const isExpanded = expandedKick === kick.id;
              return (
                <div key={kick.id}>
                  <button
                    onClick={() => setExpandedKick(isExpanded ? null : kick.id)}
                    className="flex items-center px-4 py-2.5 w-full text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <span className="w-6 text-xs text-gray-400 font-mono">{i + 1}</span>
                    <span className="w-12 text-right text-sm font-mono font-bold text-gray-900">{kick.distance}</span>
                    <span className="w-8 text-center text-xs text-gray-500">{hashLabel(kick.hash)}</span>
                    <span
                      className={`flex-1 text-center text-xs font-semibold ${
                        kick.result === 'made'
                          ? 'text-green-600'
                          : kick.result === 'blocked'
                          ? 'text-orange-500'
                          : 'text-red-600'
                      }`}
                    >
                      {resultLabel(kick.result)}
                    </span>
                    <span className="w-14 text-right text-xs text-gray-400 font-mono">
                      {kick.operation_time_ms ? formatMs(kick.operation_time_ms) : '--'}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-300 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 bg-gray-50 text-xs text-gray-600 space-y-1">
                      <div className="flex gap-4">
                        <span>Distance: <strong>{kick.distance}yd</strong></span>
                        <span>Hash: <strong>{hashLabel(kick.hash)}</strong></span>
                        <span>Result: <strong>{resultLabel(kick.result)}</strong></span>
                      </div>
                      {kick.miss_type && (
                        <div>Miss type: <strong>{missTypeLabel(kick.miss_type)}</strong></div>
                      )}
                      {kick.landing_zone && (
                        <div>Landing zone: <strong>{landingZoneLabel(kick.landing_zone)}</strong></div>
                      )}
                      {kick.operation_time_ms && (
                        <div>Operation time: <strong>{formatMs(kick.operation_time_ms)}</strong></div>
                      )}
                      {kick.notes && (
                        <div>Notes: <strong>{kick.notes}</strong></div>
                      )}
                      <div className="text-gray-400">
                        Recorded: {new Date(kick.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Session notes */}
      {session.notes && (
        <div className="card mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Session Notes</h3>
          <p className="text-sm text-gray-600">{session.notes}</p>
        </div>
      )}
    </div>
  );
}
