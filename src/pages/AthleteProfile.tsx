import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall, ApiError } from '../lib/api';
import { formatPercentage } from '../lib/utils';

interface AthleteStats {
  total_kicks: number;
  total_makes: number;
  fg_percentage: number;
  longest_make: number | null;
  practice_kicks: number;
  practice_makes: number;
  game_kicks: number;
  game_makes: number;
}

interface AthleteProfile {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  number: string | null;
  class_year: string | null;
  dominant_foot: string | null;
  height: string | null;
  weight: string | null;
  photo_url: string | null;
  team_name: string;
  created_at: string;
  updated_at: string;
  stats: AthleteStats;
}

interface EditForm {
  first_name: string;
  last_name: string;
  number: string;
  class_year: string;
  dominant_foot: string;
  height: string;
  weight: string;
}

function StatBlock({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
      <div className="text-2xl font-mono font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AthleteProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({
    first_name: '',
    last_name: '',
    number: '',
    class_year: '',
    dominant_foot: '',
    height: '',
    weight: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadAthlete = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall<AthleteProfile>(`/api/athletes/${id}`);
      setAthlete(data);
      setForm({
        first_name: data.first_name,
        last_name: data.last_name,
        number: data.number || '',
        class_year: data.class_year || '',
        dominant_foot: data.dominant_foot || '',
        height: data.height || '',
        weight: data.weight || '',
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load athlete');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAthlete();
  }, [loadAthlete]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setSaveError('First name and last name are required');
      return;
    }

    try {
      setSaving(true);
      await apiCall(`/api/athletes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          number: form.number.trim() || null,
          class_year: form.class_year || null,
          dominant_foot: form.dominant_foot || null,
          height: form.height.trim() || null,
          weight: form.weight.trim() || null,
        }),
      });
      setEditing(false);
      await loadAthlete();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Failed to update athlete');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !athlete) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="card text-center py-12">
          <p className="text-red-600 mb-3">{error || 'Athlete not found'}</p>
          <button onClick={() => navigate('/athletes')} className="btn-secondary text-sm">
            &larr; Back to Athletes
          </button>
        </div>
      </div>
    );
  }

  const { stats } = athlete;

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/athletes')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4 min-h-touch"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Athletes
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold">
              {athlete.first_name.charAt(0)}{athlete.last_name.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {athlete.first_name} {athlete.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {athlete.number && (
                <span className="text-sm font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                  #{athlete.number}
                </span>
              )}
              <span className="text-sm text-gray-500">{athlete.team_name}</span>
            </div>
            {(athlete.class_year || athlete.dominant_foot || athlete.height || athlete.weight) && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-400">
                {athlete.class_year && <span>{athlete.class_year}</span>}
                {athlete.dominant_foot && (
                  <span>
                    {athlete.dominant_foot === 'right' ? 'Right-footed' : 'Left-footed'}
                  </span>
                )}
                {athlete.height && <span>{athlete.height}</span>}
                {athlete.weight && <span>{athlete.weight} lbs</span>}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setEditing(!editing)}
          className="min-h-touch min-w-touch flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg"
          aria-label="Edit athlete"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="card mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Edit Athlete</h3>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-brand-700">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-brand-700">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jersey #</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Year</label>
                <select
                  className="input-field"
                  value={form.class_year}
                  onChange={(e) => setForm({ ...form, class_year: e.target.value })}
                >
                  <option value="">--</option>
                  <option value="Freshman">Freshman</option>
                  <option value="Sophomore">Sophomore</option>
                  <option value="Junior">Junior</option>
                  <option value="Senior">Senior</option>
                  <option value="Graduate">Graduate</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dominant Foot</label>
                <select
                  className="input-field"
                  value={form.dominant_foot}
                  onChange={(e) => setForm({ ...form, dominant_foot: e.target.value })}
                >
                  <option value="">--</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.height}
                  onChange={(e) => setForm({ ...form, height: e.target.value })}
                  placeholder='6&apos;2&quot;'
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
              <input
                type="text"
                className="input-field"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                placeholder="195"
              />
            </div>
            {saveError && <p className="text-red-600 text-sm">{saveError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatBlock
          label="Total Kicks"
          value={stats.total_kicks}
        />
        <StatBlock
          label="FG%"
          value={formatPercentage(stats.total_makes, stats.total_kicks)}
          sub={`${stats.total_makes}/${stats.total_kicks} made`}
        />
        <StatBlock
          label="Longest Make"
          value={stats.longest_make ? `${stats.longest_make}yd` : '--'}
        />
      </div>

      {/* Practice vs Game split */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Practice vs Game</h3>
        <div className="flex gap-3">
          <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
            <div className="text-xs text-green-700 font-medium mb-1">Practice</div>
            <div className="text-lg font-mono font-bold text-gray-900">
              {formatPercentage(stats.practice_makes, stats.practice_kicks)}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {stats.practice_makes}/{stats.practice_kicks} made
            </div>
          </div>
          <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-xs text-blue-700 font-medium mb-1">Game</div>
            <div className="text-lg font-mono font-bold text-gray-900">
              {formatPercentage(stats.game_makes, stats.game_kicks)}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {stats.game_makes}/{stats.game_kicks} made
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
        <button
          onClick={() => navigate(`/record?athlete=${athlete.id}`)}
          className="btn-primary w-full text-sm"
        >
          <svg className="w-5 h-5 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={2} />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
          Start Session
        </button>
      </div>

      {/* Info */}
      <div className="text-xs text-gray-400 text-center">
        Added {new Date(athlete.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}
