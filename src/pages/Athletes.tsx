import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall, ApiError } from '../lib/api';
import { formatPercentage } from '../lib/utils';

interface AthleteSummary {
  id: string;
  first_name: string;
  last_name: string;
  number: string | null;
  class_year: string | null;
  total_kicks: number;
  total_makes: number;
}

interface AddAthleteForm {
  first_name: string;
  last_name: string;
  number: string;
  class_year: string;
  dominant_foot: string;
  height: string;
  weight: string;
}

const emptyForm: AddAthleteForm = {
  first_name: '',
  last_name: '',
  number: '',
  class_year: '',
  dominant_foot: '',
  height: '',
  weight: '',
};

export default function Athletes() {
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState<AthleteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddAthleteForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAthletes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall<AthleteSummary[]>('/api/athletes');
      setAthletes(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load athletes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAthletes();
  }, [loadAthletes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError('First name and last name are required');
      return;
    }

    try {
      setSubmitting(true);
      await apiCall('/api/athletes', {
        method: 'POST',
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          number: form.number.trim() || undefined,
          class_year: form.class_year || undefined,
          dominant_foot: form.dominant_foot || undefined,
          height: form.height.trim() || undefined,
          weight: form.weight.trim() || undefined,
        }),
      });
      setForm(emptyForm);
      setShowForm(false);
      await loadAthletes();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to add athlete');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Athletes</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading...' : `${athletes.length} kicker${athletes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-sm px-4 py-2 min-h-touch flex items-center gap-1.5"
          aria-label={showForm ? 'Cancel' : 'Add Athlete'}
        >
          {showForm ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Athlete
            </>
          )}
        </button>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="card bg-red-50 border-red-200 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={loadAthletes} className="text-brand-700 text-sm font-medium mt-2 underline">
            Try again
          </button>
        </div>
      )}

      {/* Add Athlete Form */}
      {showForm && (
        <div className="card mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">New Athlete</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
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
                  placeholder="John"
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
                  placeholder="Smith"
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
                  placeholder="99"
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

            {formError && (
              <p className="text-red-600 text-sm">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? 'Saving...' : 'Save Athlete'}
            </button>
          </form>
        </div>
      )}

      {/* Athletes List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : athletes.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-gray-500 font-medium">No athletes yet</p>
          <p className="text-gray-400 text-sm mt-1">Add your first kicker to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary mt-4 text-sm"
          >
            <svg className="w-5 h-5 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Athlete
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {athletes.map((athlete) => (
            <button
              key={athlete.id}
              onClick={() => navigate(`/athletes/${athlete.id}`)}
              className="card w-full text-left active:bg-gray-50 transition-colors flex items-center gap-4"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold">
                  {athlete.first_name.charAt(0)}{athlete.last_name.charAt(0)}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {athlete.first_name} {athlete.last_name}
                  </h3>
                  {athlete.number && (
                    <span className="text-xs font-mono font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                      #{athlete.number}
                    </span>
                  )}
                  {athlete.class_year && (
                    <span className="text-xs text-gray-400">{athlete.class_year}</span>
                  )}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mt-1.5 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">FG%</span>
                    <span className="font-mono font-bold text-gray-900">
                      {formatPercentage(athlete.total_makes, athlete.total_kicks)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">Kicks</span>
                    <span className="font-mono font-bold text-gray-900">{athlete.total_kicks}</span>
                  </div>
                </div>
              </div>

              {/* Chevron */}
              <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
