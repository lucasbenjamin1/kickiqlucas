import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall, ApiError } from '../lib/api';

// Column definitions matching the printed sheet
interface KickRow {
  rowNum: number;
  distance: string;
  hash: string;
  result: string;
  opTime: string;
  landingZone: string;
  missDirection: string;
  rotation: string;
  snapQuality: string;
  holdQuality: string;
  notes: string;
  complete: boolean;
}

const HASHES = ['LH', 'LM', 'M', 'RM', 'RH'];
const HASH_VALUES: Record<string, string> = {
  'LH': 'left_hash',
  'LM': 'left_middle',
  'M': 'middle',
  'RM': 'right_middle',
  'RH': 'right_hash',
};
const RESULTS = ['Made', 'Missed', 'Blocked'];
const MISS_DIRECTIONS = ['', 'S', 'WL', 'WR', 'CB'];
const ROTATIONS = ['', 'Good', 'Okay', 'Bad'];
const LANDING_ZONES = ['', 'goalpost', 'left', 'right', 'short'];

function emptyRow(num: number): KickRow {
  return {
    rowNum: num,
    distance: '',
    hash: 'M',
    result: '',
    opTime: '',
    landingZone: '',
    missDirection: '',
    rotation: '',
    snapQuality: '',
    holdQuality: '',
    notes: '',
    complete: false,
  };
}

const INITIAL_ROWS: KickRow[] = Array.from({ length: 25 }, (_, i) => emptyRow(i + 1));

interface SessionData {
  id: string;
  athlete_id: string;
  type: string;
  first_name: string;
  last_name: string;
  sheet_photo: string | null;
}

export default function SheetEntry() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Session
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  // Photo
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState(false);

  // Grid
  const [rows, setRows] = useState<KickRow[]>(INITIAL_ROWS);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Tracking "currently editing" cell for auto-save debounce
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const completedCount = rows.filter((r) => r.complete).length;

  // Load session + photo
  useEffect(() => {
    if (!sessionId) return;
    async function load() {
      try {
        setLoading(true);
        const data = await apiCall<SessionData & { sheet_photo: string | null }>(`/api/sessions/${sessionId}`);
        setSession(data);
        if (data.sheet_photo) {
          setPhotoData(data.sheet_photo);
        }
      } catch (e) {
        setFeedback(e instanceof ApiError ? e.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  // Update a single cell
  function updateCell(rowIdx: number, field: keyof KickRow, value: string | boolean) {
    setRows((prev) => {
      const next = prev.map((r, i) => {
        if (i !== rowIdx) return r;
        const updated = { ...r, [field]: value };

        // If result changed to a non-empty value, auto-check the complete flag
        if (field === 'result' && value && !r.complete) {
          updated.complete = true;
        }
        // If distance set for the first time and has a result, mark complete
        if (field === 'distance' && value && r.result && !r.complete) {
          updated.complete = true;
        }

        return updated;
      });
      return next;
    });
    setHasUnsaved(true);
  }

  // Toggle complete checkbox
  function toggleComplete(rowIdx: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, complete: !r.complete } : r))
    );
    setHasUnsaved(true);
  }

  // Auto-save debounced — saves when user pauses typing
  useEffect(() => {
    if (!hasUnsaved) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveKicks(false);
    }, 800);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [rows, hasUnsaved]);

  // Save kicks (bulk POST)
  async function saveKicks(showFeedback: boolean) {
    if (!sessionId) return;

    const completedRows = rows.filter((r) => r.complete && r.distance && r.result);
    if (completedRows.length === 0) {
      setHasUnsaved(false);
      return;
    }

    try {
      setSaving(true);

      // Build kick payloads
      const kicks = completedRows.map((r) => {
        const dist = parseInt(r.distance);
        const body: Record<string, unknown> = {
          distance: isNaN(dist) ? 0 : dist,
          hash: HASH_VALUES[r.hash] || 'middle',
          result: r.result.toLowerCase(),
          source_type: 'paper',
        };

        if (r.opTime && parseInt(r.opTime) > 0) body.operation_time_ms = parseInt(r.opTime);
        if (r.landingZone) body.landing_zone = r.landingZone;
        if (r.missDirection) {
          const mdMap: Record<string, string> = {
            'S': 'short',
            'WL': 'wide_left',
            'WR': 'wide_right',
            'CB': 'crossbar',
          };
          body.miss_type = mdMap[r.missDirection] || null;
        }
        // Rotation, snap, hold, and notes get packed into notes field
        const extraNotes: string[] = [];
        if (r.rotation) extraNotes.push(`rotation:${r.rotation}`);
        if (r.snapQuality) extraNotes.push(`snap:${r.snapQuality}`);
        if (r.holdQuality) extraNotes.push(`hold:${r.holdQuality}`);
        const combinedNotes = [r.notes, ...extraNotes].filter(Boolean).join(' | ');
        if (combinedNotes) body.notes = combinedNotes;

        return body;
      });

      await apiCall(`/api/sessions/${sessionId}/kicks/bulk`, {
        method: 'POST',
        body: JSON.stringify({ kicks }),
      });

      setHasUnsaved(false);
      if (showFeedback) {
        setFeedback(`${kicks.length} kick${kicks.length !== 1 ? 's' : ''} saved`);
        setTimeout(() => setFeedback(null), 2500);
      }
    } catch (e) {
      if (showFeedback) {
        setFeedback(e instanceof ApiError ? e.message : 'Failed to save kicks');
      }
    } finally {
      setSaving(false);
    }
  }

  // Final submit
  async function handleSubmit() {
    if (!sessionId) return;
    await saveKicks(true);

    // End session and navigate
    try {
      await apiCall(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ended_at: new Date().toISOString() }),
      });
      navigate(`/sessions`);
    } catch (e) {
      setFeedback(e instanceof ApiError ? e.message : 'Failed to finish session');
    }
  }

  // ---- Loading ----
  if (loading) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto text-center">
        <p className="text-red-600">Session not found.</p>
        <a href="/" className="btn-secondary text-sm mt-4 inline-block">Go Home</a>
      </div>
    );
  }

  const athleteName = `${session.first_name} ${session.last_name}`;

  return (
    <div className="flex flex-col min-h-[calc(100vh-7rem)]">
      {/* Top bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 truncate">{athleteName}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Sheet Data Entry · {completedCount}/25 rows completed
          </div>
        </div>
        <div className="flex items-center gap-2">
          {feedback && (
            <span className="text-xs font-medium text-brand-700">{feedback}</span>
          )}
          {saving && (
            <span className="text-xs text-gray-400">Saving...</span>
          )}
        </div>
      </div>

      {/* Main content: photo + grid split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Photo panel */}
        <div className="lg:w-[45%] lg:max-w-[500px] border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50 overflow-auto">
          {photoData ? (
            <div
              className={`relative ${photoZoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
              onClick={() => setPhotoZoom(!photoZoom)}
            >
              <img
                src={photoData}
                alt="Tracking sheet"
                className={`w-full ${photoZoom ? 'scale-150 origin-top-left' : ''} transition-transform duration-200`}
              />
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                {photoZoom ? 'Tap to zoom out' : 'Tap to zoom'}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-8 text-center text-gray-400">
              <div>
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">No photo attached</p>
              </div>
            </div>
          )}
        </div>

        {/* Data entry grid */}
        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-5 bg-white">
                <tr>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-8">#</th>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-12">Dist</th>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-12">Hash</th>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-16">Result</th>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-14">Op Time</th>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-12">LZ</th>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-12">Miss</th>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-12">Rot</th>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-10">Snap</th>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-10">Hold</th>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-24">Notes</th>
                  <th className="border border-gray-300 bg-gray-100 px-1 py-1.5 text-center font-bold w-12">✓</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.rowNum} className={`${row.complete ? 'bg-green-50' : 'bg-white'} hover:bg-gray-50`}>
                    {/* Row number */}
                    <td className="border border-gray-200 px-1 py-1 text-center font-mono text-gray-500 text-[10px]">
                      {row.rowNum}
                    </td>

                    {/* Distance */}
                    <td className="border border-gray-200 p-0">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={99}
                        value={row.distance}
                        onChange={(e) => updateCell(idx, 'distance', e.target.value)}
                        className="w-full text-center px-1 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="--"
                      />
                    </td>

                    {/* Hash */}
                    <td className="border border-gray-200 p-0">
                      <select
                        value={row.hash}
                        onChange={(e) => updateCell(idx, 'hash', e.target.value)}
                        className="w-full text-center px-0 py-1.5 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {HASHES.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </td>

                    {/* Result */}
                    <td className="border border-gray-200 p-0">
                      <select
                        value={row.result}
                        onChange={(e) => updateCell(idx, 'result', e.target.value)}
                        className="w-full text-center px-0 py-1.5 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">--</option>
                        {RESULTS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>

                    {/* Op Time */}
                    <td className="border border-gray-200 p-0">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={9999}
                        value={row.opTime}
                        onChange={(e) => updateCell(idx, 'opTime', e.target.value)}
                        className="w-full text-center px-1 py-1.5 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="ms"
                      />
                    </td>

                    {/* Landing Zone */}
                    <td className="border border-gray-200 p-0">
                      <select
                        value={row.landingZone}
                        onChange={(e) => updateCell(idx, 'landingZone', e.target.value)}
                        className="w-full text-center px-0 py-1.5 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">--</option>
                        {LANDING_ZONES.filter(Boolean).map((lz) => (
                          <option key={lz} value={lz}>{lz === 'goalpost' ? 'GP' : lz === 'left' ? 'L' : lz === 'right' ? 'R' : 'S'}</option>
                        ))}
                      </select>
                    </td>

                    {/* Miss Direction */}
                    <td className="border border-gray-200 p-0">
                      <select
                        value={row.missDirection}
                        onChange={(e) => updateCell(idx, 'missDirection', e.target.value)}
                        className="w-full text-center px-0 py-1.5 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {MISS_DIRECTIONS.map((md) => (
                          <option key={md} value={md}>{md || '--'}</option>
                        ))}
                      </select>
                    </td>

                    {/* Rotation */}
                    <td className="border border-gray-200 p-0">
                      <select
                        value={row.rotation}
                        onChange={(e) => updateCell(idx, 'rotation', e.target.value)}
                        className="w-full text-center px-0 py-1.5 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {ROTATIONS.map((rot) => (
                          <option key={rot} value={rot}>{rot ? rot.charAt(0) : '--'}</option>
                        ))}
                      </select>
                    </td>

                    {/* Snap Quality */}
                    <td className="border border-gray-200 p-0">
                      <select
                        value={row.snapQuality}
                        onChange={(e) => updateCell(idx, 'snapQuality', e.target.value)}
                        className="w-full text-center px-0 py-1.5 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">--</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={String(n)}>{n}</option>
                        ))}
                      </select>
                    </td>

                    {/* Hold Quality */}
                    <td className="border border-gray-200 p-0">
                      <select
                        value={row.holdQuality}
                        onChange={(e) => updateCell(idx, 'holdQuality', e.target.value)}
                        className="w-full text-center px-0 py-1.5 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">--</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={String(n)}>{n}</option>
                        ))}
                      </select>
                    </td>

                    {/* Notes */}
                    <td className="border border-gray-200 p-0">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => updateCell(idx, 'notes', e.target.value)}
                        className="w-full px-1 py-1.5 text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="..."
                      />
                    </td>

                    {/* Complete checkbox */}
                    <td className="border border-gray-200 p-0 text-center">
                      <button
                        onClick={() => toggleComplete(idx)}
                        className="min-h-touch min-w-touch flex items-center justify-center w-full"
                        title={row.complete ? 'Mark incomplete' : 'Mark complete'}
                      >
                        <span className={`inline-block w-4 h-4 rounded border-2 flex items-center justify-center text-[10px]
                          ${row.complete
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 text-transparent hover:border-gray-400'
                          }`}
                        >
                          ✓
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Progress bar */}
          <div className="px-4 py-3 border-t border-gray-200 bg-white sticky bottom-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${(completedCount / 25) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600">{completedCount}/25</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={completedCount === 0 || saving}
                className="btn-primary flex-1 text-sm py-2.5 disabled:opacity-50"
              >
                {saving ? 'Saving...' : `Save & Finish (${completedCount} kicks)`}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              Only rows marked ✓ get saved as kicks. Data auto-saves as you type.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
