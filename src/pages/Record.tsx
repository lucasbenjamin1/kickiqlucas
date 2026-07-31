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

const HASHES: { value: string; label: string; short: string }[] = [
  { value: 'left_hash', label: 'Left Hash', short: 'LH' },
  { value: 'left_middle', label: 'Left Middle', short: 'LM' },
  { value: 'middle', label: 'Middle', short: 'M' },
  { value: 'right_middle', label: 'Right Middle', short: 'RM' },
  { value: 'right_hash', label: 'Right Hash', short: 'RH' },
];

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

function hashShortLabel(hash: string): string {
  const h = HASHES.find(x => x.value === hash);
  return h ? h.short : hash;
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

  // Athlete picker (shown when no session and no preselected athlete)
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState(preselectedAthleteId || '');
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Kick form state
  const [distance, setDistance] = useState<number>(35);
  const [customDistance, setCustomDistance] = useState('');
  const [hash, setHash] = useState<string>('middle');
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
  const [saveFlash, setSaveFlash] = useState(false);

  const distanceInputRef = useRef<HTMLInputElement>(null);

  // Load active session on mount
  useEffect(() => {
    const sessionId = getActiveSessionId();
    if (sessionId) {
      loadSession(sessionId);
    } else if (preselectedAthleteId) {
      // Auto-create session when athlete is preselected
      createInstantSession(preselectedAthleteId);
    } else {
      setLoadingSession(false);
      loadAthletes();
    }
  }, []);

  async function loadAthletes() {
    try {
      const data = await apiCall<AthleteOption[]>('/api/athletes');
      setAthletes(data);
      if (data.length === 1) {
        setSelectedAthleteId(data[0].id);
      }
    } catch (e) {
      setSessionError('Failed to load athletes');
    }
  }

  async function loadSession(sessionId: string) {
    try {
      setLoadingSession(true);
      const data = await apiCall<ActiveSession & { kick_count: number }>(`/api/sessions/${sessionId}`);
      if (data.ended_at) {
        setActiveSessionId(null);
        setActiveSession(null);
        // If we have a preselected athlete, auto-create a new session
        if (preselectedAthleteId) {
          createInstantSession(preselectedAthleteId);
          return;
        }
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

  async function createInstantSession(athleteId: string) {
    try {
      setCreatingSession(true);
      setSessionError(null);
      const data = await apiCall<ActiveSession>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          athlete_id: athleteId,
          type: 'practice',
        }),
      });
      setActiveSessionId(data.id);
      setActiveSession(data);
      setKickCount(0);
      setLastKick(null);
      setResult(null);
      setLandingZone(null);
      setMissType(null);
      setOperationTime('');
      setKickNotes('');
      setLoadingSession(false);
    } catch (e) {
      setSessionError(e instanceof ApiError ? e.message : 'Failed to create session');
      setLoadingSession(false);
    } finally {
      setCreatingSession(false);
    }
  }

  async function handleStartSession() {
    if (!selectedAthleteId) return;
    createInstantSession(selectedAthleteId);
  }

  // Auto-save when result is selected and we have distance and hash
  useEffect(() => {
    if (activeSession && result && distance && hash && !savingKick) {
      autoSaveKick();
    }
  }, [result]);

  async function autoSaveKick() {
    if (!activeSession || !distance || !hash || !result) return;
    const savedResult = result;

    try {
      setSavingKick(true);
      const body: Record<string, unknown> = { distance, hash, result: savedResult };

      if (savedResult === 'missed' && missType) body.miss_type = missType;
      if (landingZone) body.landing_zone = landingZone;
      if (operationTime && parseInt(operationTime) > 0) body.operation_time_ms = parseInt(operationTime);
      if (kickNotes.trim()) body.notes = kickNotes.trim();

      const kick = await apiCall<{ id: string; distance: number; hash: string; result: string }>(
        `/api/sessions/${activeSession.id}/kicks`,
        { method: 'POST', body: JSON.stringify(body) }
      );

      setKickCount(c => c + 1);
      setLastKick({ id: kick.id, distance: kick.distance, hash: kick.hash, result: kick.result });
      setResult(null);
      setLandingZone(null);
      setMissType(null);
      setOperationTime('');
      setKickNotes('');
      setShowMore(false);

      // Flash indicator
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 600);

      setFeedback(`Kick #${kickCount + 1} saved`);
      setTimeout(() => setFeedback(null), 2000);
    } catch (e) {
      setFeedback(e instanceof ApiError ? e.message : 'Failed to save kick');
      // Reset result so coach can retry
      setResult(null);
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
      setActiveSessionId(null);
      setActiveSession(null);
      setShowFinishConfirm(false);
      navigate('/sessions');
    } catch (e) {
      setFeedback(e instanceof ApiError ? e.message : 'Failed to finish session');
      setShowFinishConfirm(false);
    } finally {
      setFinishing(false);
    }
  }

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
  if (loadingSession || creatingSession) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  // ------- No Active Session — Show quick athlete picker -------
  if (!activeSession) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h2 className="text-xl font-bold text-gray-900">Record Kicks</h2>
        <p className="text-gray-500 mt-1">Start a session to begin recording kicks.</p>

        <div className="card mt-6 space-y-4">
          {sessionError && <p className="text-red-600 text-sm">{sessionError}</p>}

          {athletes.length === 0 ? (
            <>
              <p className="text-sm text-gray-500 text-center py-4">No athletes found. Add an athlete first.</p>
              <button onClick={() => navigate('/athletes')} className="btn-primary w-full text-sm">
                Add Athlete
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Athlete</label>
                <select
                  className="input-field"
                  value={selectedAthleteId}
                  onChange={(e) => setSelectedAthleteId(e.target.value)}
                >
                  <option value="">Select athlete...</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}{a.number ? ` (#${a.number})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleStartSession}
                disabled={!selectedAthleteId || creatingSession}
                className="btn-primary w-full text-lg font-bold py-4"
              >
                {creatingSession ? 'Starting...' : 'Start Session'}
              </button>
            </>
          )}
        </div>
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
        {/* Save flash indicator */}
        <div className={`mt-1 text-xs font-medium transition-opacity duration-300 ${saveFlash ? 'opacity-100 text-green-600' : 'opacity-0'}`}>
          ✓ Saved
        </div>
        {feedback && !saveFlash && (
          <div className="mt-1.5 text-xs font-medium text-brand-700">{feedback}</div>
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

        {/* Hash — 5 buttons, narrower on mobile */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Hash</label>
          <div className="grid grid-cols-5 gap-1.5">
            {HASHES.map((h) => (
              <button
                key={h.value}
                type="button"
                onClick={() => setHash(h.value)}
                title={h.label}
                className={`min-h-[48px] rounded-lg font-semibold text-xs transition-colors
                  ${hash === h.value
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 active:bg-gray-200 hover:bg-gray-200'
                  }`}
              >
                <span className="block">{h.short}</span>
                <span className="block text-[10px] opacity-70 mt-0.5">{h.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Result — 3 large color-coded buttons (auto-saves on click) */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Result</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setResult('made')}
              disabled={savingKick}
              className={`min-h-[56px] rounded-lg font-bold text-sm transition-all
                ${result === 'made'
                  ? 'bg-green-600 text-white shadow-md scale-[1.02]'
                  : 'bg-green-50 text-green-800 border border-green-200 active:bg-green-100'
                } ${savingKick ? 'opacity-60' : ''}`}
            >
              ✅ Made
            </button>
            <button
              type="button"
              onClick={() => setResult('missed')}
              disabled={savingKick}
              className={`min-h-[56px] rounded-lg font-bold text-sm transition-all
                ${result === 'missed'
                  ? 'bg-red-600 text-white shadow-md scale-[1.02]'
                  : 'bg-red-50 text-red-800 border border-red-200 active:bg-red-100'
                } ${savingKick ? 'opacity-60' : ''}`}
            >
              ❌ Missed
            </button>
            <button
              type="button"
              onClick={() => setResult('blocked')}
              disabled={savingKick}
              className={`min-h-[56px] rounded-lg font-bold text-sm transition-all
                ${result === 'blocked'
                  ? 'bg-orange-500 text-white shadow-md scale-[1.02]'
                  : 'bg-orange-50 text-orange-800 border border-orange-200 active:bg-orange-100'
                } ${savingKick ? 'opacity-60' : ''}`}
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

        {/* Operation Time — on main form */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Op Time (ms)</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            value={operationTime}
            onChange={(e) => setOperationTime(e.target.value)}
            placeholder="e.g. 1250"
            className="input-field w-36"
          />
        </div>

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

        {/* More section (collapsible) — notes only */}
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

        {/* Last kick info */}
        {lastKick && (
          <div className="text-center text-xs text-gray-400 pt-1">
            Last: {lastKick.distance}yd {hashShortLabel(lastKick.hash)} — {resultLabel(lastKick.result)}
          </div>
        )}
      </div>

      {/* Bottom action bar — just Undo */}
      <div className="sticky bottom-0 px-4 py-3 bg-white border-t border-gray-100 safe-bottom">
        <button
          type="button"
          onClick={undoLastKick}
          disabled={!lastKick || undoing}
          className="btn-secondary w-full text-sm flex items-center justify-center gap-1 disabled:opacity-30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          {undoing ? 'Undoing...' : 'Undo Last Kick'}
        </button>
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
