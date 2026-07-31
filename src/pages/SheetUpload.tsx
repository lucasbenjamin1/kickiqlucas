import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall, ApiError } from '../lib/api';

interface AthleteOption {
  id: string;
  first_name: string;
  last_name: string;
  number: string | null;
}

const SESSION_TYPES = [
  { value: 'practice', label: 'Practice' },
  { value: 'game', label: 'Game' },
  { value: 'pregame', label: 'Pregame' },
  { value: 'scrimmage', label: 'Scrimmage' },
  { value: 'tryout', label: 'Tryout' },
  { value: 'camp', label: 'Camp' },
  { value: 'other', label: 'Other' },
];

export default function SheetUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo state
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Athlete / session state
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const [sessionType, setSessionType] = useState('practice');
  const [loadingAthletes, setLoadingAthletes] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load athletes
  useEffect(() => {
    async function load() {
      try {
        setLoadingAthletes(true);
        const data = await apiCall<AthleteOption[]>('/api/athletes');
        setAthletes(data);
        if (data.length > 0) setSelectedAthleteId(data[0].id);
      } catch {
        // non-fatal
      } finally {
        setLoadingAthletes(false);
      }
    }
    load();
  }, []);

  // Handle file input
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function processFile(file: File) {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(heic|heif)$/i)) {
      setError('Please upload a JPEG, PNG, or HEIC image.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Photo must be under 10MB.');
      return;
    }

    setError(null);
    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoData(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  // Upload and create session
  async function handleContinue() {
    if (!photoData || !selectedAthleteId) return;

    try {
      setUploading(true);
      setError(null);

      // Create session first
      const session = await apiCall<{ id: string }>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          athlete_id: selectedAthleteId,
          type: sessionType,
        }),
      });

      // Upload photo to session
      await apiCall(`/api/sessions/${session.id}/photo`, {
        method: 'POST',
        body: JSON.stringify({ photo: photoData }),
      });

      // Navigate to data entry
      navigate(`/sheets/entry/${session.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to upload sheet. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  if (loadingAthletes) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* Back link */}
      <a href="/" className="text-sm text-gray-500 hover:text-gray-700 underline mb-4 inline-block">
        &larr; Home
      </a>

      <h2 className="text-xl font-bold text-gray-900">Upload Tracking Sheet</h2>
      <p className="text-gray-500 text-sm mt-1">
        Photograph a filled-out tracking sheet, then enter the data.
      </p>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Photo upload area */}
      <div className="mt-5">
        {!photoData ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer min-h-[200px] flex flex-col items-center justify-center
              ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">Tap to upload a photo of your sheet</p>
            <p className="text-xs text-gray-400 mt-1">JPEG, PNG, or HEIC — max 10MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        ) : (
          <div>
            {/* Preview */}
            <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
              <img
                src={photoData}
                alt="Sheet preview"
                className="w-full max-h-[300px] object-contain"
              />
              <button
                onClick={() => {
                  setPhotoData(null);
                  setPhotoFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow text-gray-600 hover:text-gray-900 min-h-touch min-w-touch flex items-center justify-center"
                title="Remove photo"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {photoFile ? `${photoFile.name} (${Math.round(photoFile.size / 1024)}KB)` : 'Photo ready'}
            </p>
          </div>
        )}
      </div>

      {/* Session targeting */}
      {photoData && (
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Athlete</label>
            {athletes.length === 0 ? (
              <p className="text-sm text-gray-500">No athletes yet. <a href="/athletes" className="text-brand-700 underline">Add one</a>.</p>
            ) : athletes.length === 1 ? (
              <p className="text-sm font-semibold text-gray-900">{athletes[0].first_name} {athletes[0].last_name}</p>
            ) : (
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
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Type</label>
            <select
              className="input-field"
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
            >
              {SESSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleContinue}
            disabled={!selectedAthleteId || uploading}
            className="btn-primary w-full text-lg font-bold py-4 flex items-center justify-center gap-2"
          >
            {uploading ? (
              'Uploading...'
            ) : (
              <>
                Continue to Data Entry
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
