import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiCall, ApiError } from '../lib/api';

// Types
interface AthleteOption {
  id: string;
  first_name: string;
  last_name: string;
  number: string | null;
}

interface ActiveSession {
  id: string;
  athlete_id: string;
  type: string;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  first_name: string;
  last_name: string;
  number: string | null;
  kick_count?: number;
}

interface LastKick {
  id: string;
  distance: number;
  hash: string;
  result: string;
}

// Session type labels
const SESSION_TYPES = [
  { value: 'practice', label: 'Practice' },
  { value: 'game', label: 'Game' },
  { value: 'pregame', label: 'Pregame' },
  { value: 'scrimmage', label: 'Scrimmage' },
  { value: 'tryout', label: 'Tryout' },
  { value: 'camp', label: 'Camp' },
  { value: 'other', label: 'Other' },
];

const DISTANCE_PRESETS = [20, 25, 30, 35, 40, 45, 50, 55, 60];

function getActiveSessionId(): string | null {
  try {
    return sessionStorage.getItem('kickiq_active_session');
  } catch { return null; }
}

function setActiveSessionId(id: string | null): void {
  try {
    if (id) sessionStorage.setItem('kickiq_active_session', id);
    else sessionStorage.removeItem('kickiq_active_session');
  } catch { /* ignore */ }
}

function hashLabel(hash: string): string {
  return hash === 'left' ? 'Left Hash' : hash === 'center' ? 'Middle' : 'Right Hash';
}

function resultLabel(result: string): string {
  return result === 'made' ? 'Made' : result === 'missed' ? 'Missed' : 'Blocked';
}

function sessionTypeLabel(type: string): string {
  return SESSION_TYPES.find(t => t.value === type)?.label || type;
}

export default function Record() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedAthleteId = searchParams.get('athlete') || undefined;

  // Session state
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [kickCount, setKickCount] = useState(0);

  // New session form
  const [showNewSession, setShowNewSession] = useState(false);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [newSessionAthlete, setNewSessionAthlete] = useState(preselectedAthleteId || '');
  const [newSessionType, setNewSessionType] = useState('practice');
  const [newSessionNotes, setNewSessionNotes] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Kick form state
  const [distance, setDistance] = useState<number>(35);
  const [customDistance, setCustomDistance] = useState('');
  const [hash, setHash] = useState<string>('center');
  const [result, setResult] = useState<string | null>(null);
  const [landingZone, setLandingZone] = useState<string | null>(null);
  const [missType, setMissType] = useState<string | null>(null);
  const [operationTime, setOperationTime] = useState('');
  const [kickNotes, setKickNotes] = useState('');
  const [showMore, setShowMore] = useState(false);

  // Kick save state
  const [savingKick, setSavingKick] = useState(false);
  const [lastKick, setLastKick] = useState<LastKick | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const distanceInputRef = useRef<HTMLInputElement>(null);

  // Load active session on mount
  useEffect(() => {
    const sessionId = getActiveSessionId();
    if (sessionId) {
      loadSession(sessionId);
    } else {
      setLoadingSession(false);
    }
  }, []);

  // Load athletes for new session form
  useEffect(() => {
    if (showNewSession) {
      loadAthletes();
    }
  }, [showNewSession]);

  async function loadSession(sessionId: string) {
    try {
      setLoadingSession(true);
      const data = await apiCall<ActiveSession & { kick_count: number }>(`/api/sessions/${sessionId}`);
      if (data.ended_at) {
        // Session already ended, clear it
        setActiveSessionId(null);
        setActiveSession(null);
      } else {
        setActiveSession(data);
        setKickCount(data.kick_count || 0);
      }
    } catch {
      setActiveSessionId(null);
      setActiveSession(null);
    } finally {
      setLoadingSession(false);
    }
  }

  async function loadAthletes() {
    try {
      const data = await apiCall<AthleteOption[]>('/api/athletes');
      setAthletes(data);
      if (data.length === 0) {
        setSessionError('No athletes found. Add an athlete first.');
      }
    } catch (e) {
      setSessionError('Failed to load athletes');
    }
  }

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    if (!newSessionAthlete || !newSessionType) return;

    try {
      setCreatingSession(true);
      setSessionError(null);
      const data = await apiCall<ActiveSession>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          athlete_id: newSessionAthlete,
          type: newSessionType,
          notes: newSessionNotes.trim() || null,
        }),
      });
      setActiveSessionId(data.id);
      setActiveSession(data);
      setKickCount(0);
      setShowNewSession(false);
      setLastKick(null);
      setResult(null);
      setLandingZone(null);
      setMissType(null);
      setOperationTime('');
      setKickNotes('');
    } catch (e) {
      setSessionError(e instanceof ApiError ? e.message : 'Failed to create session');
    } finally {
      setCreatingSession(false);
    }
  }

  async function saveKick() {
    if (!activeSession || !distance || !hash || !result) return;

    try {
      setSavingKick(true);
      const body: Record<string, unknown> = { distance, hash, result };

      if (result === 'missed' && missType) body.miss_type = missType;
      if (landingZone) body.landing_zone = landingZone;
      if (operationTime && parseInt(operationTime) > 0) body.operation_time_ms = parseInt(operationTime);
      if (kickNotes.trim()) body.notes = kickNotes.trim();

      const kick = await apiCall<{ id: string; distance: number; hash: string; result: string }>(
        `/api/sessions/${activeSession.id}/kicks`,
        { method: 'POST', body: JSON.stringify(body) }
      );

      // Update state
      setKickCount(c => c + 1);
      setLastKick({ id: kick.id, distance: kick.distance, hash: kick.hash, result: kick.result });
      setResult(null);
      setLandingZone(null);
      setMissType(null);
      setOperationTime('');
      setKickNotes('');
      setFeedback(`Kick #${kickCount + 1} saved`);

      // Clear feedback after 2s
      setTimeout(() => setFeedback(null), 2000);

      // Clear "More" section on save
      if (showMore) setShowMore(false);
    } catch (e) {
      setFeedback(e instanceof ApiError ? e.message : 'Failed to save kick');
    } finally {
      setSavingKick(false);
    }
  }

  async function undoLastKick() {
    if (!activeSession || !lastKick) return;

    try {
      setUndoing(true);
      await apiCall(`/api/sessions/${activeSession.id}/kicks/${lastKick.id}`, { method: 'DELETE' });
      setKickCount(c => c - 1);
      setLastKick(null);
      setFeedback('Last kick undone');
      setTimeout(() => setFeedback(null), 2000);
    } catch (e) {
      setFeedback(e instanceof ApiError ? e.message : 'Failed to undo kick');
    } finally {
      setUndoing(false);
    }
  }

  async function finishSession() {
    if (!activeSession) return;

    try {
      setFinishing(true);
      await apiCall(`/api/sessions/${activeSession.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ended_at: new Date().toISOString() }),
      });
      const finishedSessionId = activeSession.id;
      setActiveSessionId(null);
      setActiveSession(null);
      setShowFinishConfirm(false);

      // Navigate to session summary
      navigate(`/sessions/${finishedSessionId}`);
    } catch (e) {
      setFeedback(e instanceof ApiError ? e.message : 'Failed to finish session');
      setShowFinishConfirm(false);
    } finally {
      setFinishing(false);
    }
  }

  // Handle keyboard submit on custom distance
  const handleCustomDistanceKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customDistance) {
      const d = parseInt(customDistance);
      if (d > 0 && d < 100) {
        setDistance(d);
        setCustomDistance('');
      }
    }
  }, [customDistance]);

  // ------- Loading -------
  if (loadingSession) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  // ------- No Active Session / New Session Form -------
  if (!activeSession && !showNewSession) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold text-gray-900">Record Kicks</h2>
        <p className="text-gray-500 mt-1">Start a session to begin recording kicks.</p>

        <div className="card mt-6 text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
              <circle cx="12" cy="12" r="4" fill="currentColor" />
            </svg>
            <p className="text-sm">No active session</p>
            <p className="text-xs mt-1">Start a new session to begin recording kicks.</p>
          </div>
          <button
            onClick={() => setShowNewSession(true)}
            className="btn-primary w-full"
          >
            New Session
          </button>
        </div>

        <div className="mt-4">
          <p className="text-xs text-gray-400 text-center">
            Tip: You can also start a session from an athlete's profile.
          </p>
        </div>
      </div>
    );
  }

  // ------- New Session Form -------
  if (!activeSession && showNewSession) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setShowNewSession(false)}
            className="min-h-touch min-w-touch flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-900">New Session</h2>
        </div>

        <form onSubmit={createSession} className="card space-y-4">
          {/* Athlete dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Athlete <span className="text-brand-700">*</span>
            </label>
            <select
              className="input-field"
              value={newSessionAthlete}
              onChange={(e) => setNewSessionAthlete(e.target.value)}
              required
            >
              <option value="">Select athlete...</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}{a.number ? ` (#${a.number})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Session type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Type <span className="text-brand-700">*</span>
            </label>
            <select
              className="input-field"
              value={newSessionType}
              onChange={(e) => setNewSessionType(e.target.value)}
              required
            >
              {SESSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="input-field resize-none"
              rows={2}
              value={newSessionNotes}
              onChange={(e) => setNewSessionNotes(e.target.value)}
              placeholder="Optional notes about this session..."
            />
          </div>

          {sessionError && <p className="text-red-600 text-sm">{sessionError}</p>}

          <button type="submit" disabled={creatingSession || !newSessionAthlete} className="btn-primary w-full">
            {creatingSession ? 'Creating...' : 'Start Session'}
          </button>
        </form>
      </div>
    );
  }

  // ------- Active Recording Screen -------
  const athleteName = activeSession ? `${activeSession.first_name} ${activeSession.last_name}` : '';

  return (
    <div className="flex flex-col min-h-[calc(100vh-7rem)] max-w-lg mx-auto">
      {/* Session header bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900 truncate">{athleteName}</div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              <span>{sessionTypeLabel(activeSession!.type)}</span>
              <span>·</span>
              <span className="font-mono font-bold text-brand-700">Kick #{kickCount + 1}</span>
            </div>
          </div>
          <button
            onClick={() => setShowFinishConfirm(true)}
            className="text-xs text-gray-400 hover:text-red-600 min-h-touch min-w-touch flex items-center justify-center rounded-lg transition-colors"
          >
            Finish
          </button>
        </div>
        {feedback && (
          <div className="mt-1.5 text-xs font-medium text-brand-700 animate-pulse">{feedback}</div>
        )}
      </div>

      {/* Quick-entry form */}
      <div className="flex-1 px-4 py-3 space-y-4">
        {/* Distance — preset buttons + custom */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Distance (yds)</label>
          <div className="flex flex-wrap gap-2">
            {DISTANCE_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setDistance(d); setCustomDistance(''); }}
                className={`min-h-touch min-w-[52px] rounded-lg font-mono text-base font-bold transition-colors
                  ${distance === d
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 active:bg-gray-200 hover:bg-gray-200'
                  }`}
              >
                {d}
              </button>
            ))}
            {/* Custom distance */}
            <div className="relative">
              <input
                ref={distanceInputRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={customDistance}
                onChange={(e) => {
                  setCustomDistance(e.target.value);
                  const d = parseInt(e.target.value);
                  if (d > 0 && d < 100) setDistance(d);
                }}
                onKeyDown={handleCustomDistanceKeyDown}
                placeholder="..."
                className="w-[52px] min-h-touch rounded-lg border border-gray-300 text-center font-mono text-base font-bold
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Hash — 3 large buttons */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Hash</label>
          <div className="grid grid-cols-3 gap-2">
            {(['left', 'center', 'right'] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHash(h)}
                className={`min-h-[52px] rounded-lg font-semibold text-sm transition-colors
                  ${hash === h
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 active:bg-gray-200 hover:bg-gray-200'
                  }`}
              >
                {hashLabel(h)}
              </button>
            ))}
          </div>
        </div>

        {/* Result — 3 large color-coded buttons */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Result</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setResult('made')}
              className={`min-h-[56px] rounded-lg font-bold text-sm transition-all
                ${result === 'made'
                  ? 'bg-green-600 text-white shadow-md scale-[1.02]'
                  : 'bg-green-50 text-green-800 border border-green-200 active:bg-green-100'
                }`}
            >
              ✅ Made
            </button>
            <button
              type="button"
              onClick={() => setResult('missed')}
              className={`min-h-[56px] rounded-lg font-bold text-sm transition-all
                ${result === 'missed'
                  ? 'bg-red-600 text-white shadow-md scale-[1.02]'
                  : 'bg-red-50 text-red-800 border border-red-200 active:bg-red-100'
                }`}
            >
              ❌ Missed
            </button>
            <button
              type="button"
              onClick={() => setResult('blocked')}
              className={`min-h-[56px] rounded-lg font-bold text-sm transition-all
                ${result === 'blocked'
                  ? 'bg-orange-500 text-white shadow-md scale-[1.02]'
                  : 'bg-orange-50 text-orange-800 border border-orange-200 active:bg-orange-100'
                }`}
            >
              🚫 Blocked
            </button>
          </div>
        </div>

        {/* Miss type — shown only when missed */}
        {result === 'missed' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Miss Type</label>
            <div className="flex gap-2 flex-wrap">
              {(['short', 'wide_left', 'wide_right'] as const).map((mt) => (
                <button
                  key={mt}
                  type="button"
                  onClick={() => setMissType(missType === mt ? null : mt)}
                  className={`min-h-touch px-4 rounded-lg text-sm font-medium transition-colors
                    ${missType === mt
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 active:bg-gray-100'
                    }`}
                >
                  {mt === 'short' ? 'Short' : mt === 'wide_left' ? 'Wide Left' : 'Wide Right'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Landing Zone — optional quick select */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Landing Zone</label>
          <div className="flex gap-2 flex-wrap">
            {(['goalpost', 'left', 'right', 'short'] as const).map((lz) => (
              <button
                key={lz}
                type="button"
                onClick={() => setLandingZone(landingZone === lz ? null : lz)}
                className={`min-h-touch px-4 rounded-lg text-sm font-medium transition-colors
                  ${landingZone === lz
                    ? 'bg-brand-100 text-brand-800 border border-brand-300'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 active:bg-gray-100'
                  }`}
              >
                {lz === 'goalpost' ? 'Goalpost' : lz === 'left' ? 'Left' : lz === 'right' ? 'Right' : 'Short'}
              </button>
            ))}
          </div>
        </div>

        {/* More section (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 min-h-touch"
          >
            <svg className={`w-4 h-4 transition-transform ${showMore ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            More options
          </button>

          {showMore && (
            <div className="mt-2 space-y-3 pl-1">
              {/* Operation time */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Operation Time (ms)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9999}
                  value={operationTime}
                  onChange={(e) => setOperationTime(e.target.value)}
                  placeholder="e.g. 1250"
                  className="input-field w-32"
                />
              </div>

              {/* Kick notes */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <input
                  type="text"
                  value={kickNotes}
                  onChange={(e) => setKickNotes(e.target.value)}
                  placeholder="Quick note..."
                  className="input-field"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 px-4 py-3 bg-white border-t border-gray-100 safe-bottom space-y-3">
        {/* Undo + Save row */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={undoLastKick}
            disabled={!lastKick || undoing}
            className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            {undoing ? '...' : 'Undo'}
          </button>

          <button
            type="button"
            onClick={saveKick}
            disabled={!result || savingKick}
            className="btn-primary flex-1 text-base font-bold"
          >
            {savingKick ? 'Saving...' : `Save & Next`}
          </button>
        </div>

        {/* Last kick info */}
        {lastKick && (
          <div className="text-center text-xs text-gray-400">
            Last: {lastKick.distance}yd {hashLabel(lastKick.hash)} — {resultLabel(lastKick.result)}
          </div>
        )}
      </div>

      {/* Finish session confirmation modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-w-sm w-full text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Finish Session?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will end the current session with {kickCount} kick{kickCount !== 1 ? 's' : ''} recorded.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="btn-secondary flex-1"
                disabled={finishing}
              >
                Cancel
              </button>
              <button
                onClick={finishSession}
                className="btn-primary flex-1"
                disabled={finishing}
              >
                {finishing ? 'Finishing...' : 'Finish Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
