import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall, ApiError } from '../lib/api';
import { formatPercentage } from '../lib/utils';

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
  makes: number;
  longest_make: number | null;
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

function sessionLabel(type: string): string {
  return SESSION_TYPES[type] || type;
}

type SortKey = 'date' | 'athlete' | 'type' | 'kicks' | 'fgpct' | 'longest' | 'status';

export default function Sessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall<Session[]>('/api/sessions');
      setSessions(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedSessions = useMemo(() => {
    const sorted = [...sessions];
    const dir = sortDir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'date':
          return dir * (new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
        case 'athlete':
          return dir * `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
        case 'type':
          return dir * a.type.localeCompare(b.type);
        case 'kicks':
          return dir * (a.kick_count - b.kick_count);
        case 'fgpct': {
          const pa = a.kick_count > 0 ? a.makes / a.kick_count : -1;
          const pb = b.kick_count > 0 ? b.makes / b.kick_count : -1;
          return dir * (pa - pb);
        }
        case 'longest': {
          const la = a.longest_make ?? -1;
          const lb = b.longest_make ?? -1;
          return dir * (la - lb);
        }
        case 'status': {
          const sa = a.ended_at ? 1 : 0;
          const sb = b.ended_at ? 1 : 0;
          return dir * (sa - sb);
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [sessions, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-brand-700 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 w-36" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Sessions</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/sheets/upload')}
            className="btn-secondary text-sm px-3 py-2 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload
          </button>
          <button
            onClick={() => navigate('/record')}
            className="btn-primary text-sm px-3 py-2 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 mb-4 text-center">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={loadSessions} className="btn-secondary text-sm mt-2">Retry</button>
        </div>
      )}

      {sessions.length === 0 && !error && (
        <div className="border border-gray-200 text-center py-12 px-4">
          <div className="text-gray-400 mb-3">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No sessions yet</p>
            <p className="text-xs mt-1">Record some kicks to get started.</p>
          </div>
          <button
            onClick={() => navigate('/record')}
            className="btn-primary text-sm"
          >
            Start a Session
          </button>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="table-wrap">
          <div className="table-wrap-inner">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('date')} className={sortKey === 'date' ? 'sorted' : ''}>
                    Date<SortIcon col="date" />
                  </th>
                  <th onClick={() => handleSort('athlete')} className={sortKey === 'athlete' ? 'sorted' : ''}>
                    Athlete<SortIcon col="athlete" />
                  </th>
                  <th onClick={() => handleSort('type')} className={sortKey === 'type' ? 'sorted' : ''}>
                    Type<SortIcon col="type" />
                  </th>
                  <th onClick={() => handleSort('kicks')} className={sortKey === 'kicks' ? 'sorted' : ''}>
                    Kicks<SortIcon col="kicks" />
                  </th>
                  <th onClick={() => handleSort('fgpct')} className={sortKey === 'fgpct' ? 'sorted' : ''}>
                    FG%<SortIcon col="fgpct" />
                  </th>
                  <th onClick={() => handleSort('longest')} className={sortKey === 'longest' ? 'sorted' : ''}>
                    Long<SortIcon col="longest" />
                  </th>
                  <th onClick={() => handleSort('status')} className={sortKey === 'status' ? 'sorted' : ''}>
                    Status<SortIcon col="status" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="clickable"
                    onClick={() => {
                      if (!session.ended_at) {
                        sessionStorage.setItem('kickiq_active_session', session.id);
                        navigate('/record');
                      } else {
                        navigate('/record');
                      }
                    }}
                  >
                    <td className="text-xs whitespace-nowrap">
                      {formatDate(session.started_at)}
                    </td>
                    <td className="font-medium whitespace-nowrap">
                      {session.first_name} {session.last_name}
                      {session.number && <span className="text-gray-400 ml-1">#{session.number}</span>}
                    </td>
                    <td>
                      <span className="text-xs font-medium px-1.5 py-0.5 border border-gray-200 text-gray-600">
                        {sessionLabel(session.type)}
                      </span>
                    </td>
                    <td className="font-mono">
                      {session.kick_count}
                    </td>
                    <td className="font-mono font-bold">
                      {session.kick_count > 0
                        ? formatPercentage(session.makes, session.kick_count)
                        : '--'}
                    </td>
                    <td className="font-mono">
                      {session.longest_make ? `${session.longest_make}yd` : '—'}
                    </td>
                    <td className="whitespace-nowrap">
                      {!session.ended_at ? (
                        <span className="text-xs text-brand-700 font-medium">● Live</span>
                      ) : (
                        <span className="text-xs text-gray-400">Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
