import { useState, useEffect, useCallback } from 'react';
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

function typeBadgeColor(type: string): string {
  switch (type) {
    case 'game': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'practice': return 'bg-green-50 text-green-700 border-green-200';
    case 'pregame': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

export default function Sessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-36" />
          <div className="h-4 bg-gray-200 rounded w-64" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Sessions</h2>
          <p className="text-gray-500 text-sm mt-0.5">Review past practice and game sessions.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/sheets/upload')}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload
          </button>
          <button
            onClick={() => navigate('/record')}
            className="btn-primary text-sm flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New
          </button>
        </div>
      </div>

      {error && (
        <div className="card mb-4 text-center py-4">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={loadSessions} className="btn-secondary text-sm mt-2">Retry</button>
        </div>
      )}

      {sessions.length === 0 && !error && (
        <div className="card text-center py-12">
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

      <div className="space-y-2">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => {
              // If session is active (no ended_at), go to record
              if (!session.ended_at) {
                sessionStorage.setItem('kickiq_active_session', session.id);
                navigate('/record');
              } else {
                // Placeholder — will navigate to session summary later
                navigate(`/record`);
              }
            }}
            className="card w-full text-left hover:border-gray-300 transition-colors active:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 truncate">
                    {session.first_name} {session.last_name}
                  </span>
                  {session.number && (
                    <span className="text-xs font-mono text-gray-400">#{session.number}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${typeBadgeColor(session.type)}`}>
                    {sessionLabel(session.type)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(session.started_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                  {!session.ended_at && (
                    <span className="text-xs text-brand-700 font-medium animate-pulse">● Live</span>
                  )}
                </div>
              </div>

              <div className="text-right ml-3 flex-shrink-0">
                <div className="text-lg font-mono font-bold text-gray-900">
                  {session.kick_count > 0
                    ? formatPercentage(session.makes, session.kick_count)
                    : '--'}
                </div>
                <div className="text-xs text-gray-400">
                  {session.makes}/{session.kick_count} made
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
