import { useState, useEffect, useCallback, useMemo } from 'react';
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
  longest_make: number | null;
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

type SortKey = 'name' | 'number' | 'class' | 'fgpct' | 'kicks' | 'longest';

export default function Athletes() {
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState<AthleteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddAthleteForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedAthletes = useMemo(() => {
    const sorted = [...athletes];
    const dir = sortDir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
        case 'number': {
          const na = a.number ? parseInt(a.number) || 999 : 999;
          const nb = b.number ? parseInt(b.number) || 999 : 999;
          return dir * (na - nb);
        }
        case 'class': {
          const order = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];
          const ca = a.class_year ? order.indexOf(a.class_year) : -1;
          const cb = b.class_year ? order.indexOf(b.class_year) : -1;
          return dir * (ca - cb);
        }
        case 'fgpct': {
          const pa = a.total_kicks > 0 ? a.total_makes / a.total_kicks : -1;
          const pb = b.total_kicks > 0 ? b.total_makes / b.total_kicks : -1;
          return dir * (pa - pb);
        }
        case 'kicks':
          return dir * (a.total_kicks - b.total_kicks);
        case 'longest': {
          const la = a.longest_make ?? -1;
          const lb = b.longest_make ?? -1;
          return dir * (la - lb);
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [athletes, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-brand-700 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

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
          <h2 className="text-lg font-bold text-gray-900">Athletes</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">
            {loading ? '...' : `${athletes.length} kicker${athletes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-sm px-3 py-2 min-h-touch flex items-center gap-1.5"
          aria-label={showForm ? 'Cancel' : 'Add Athlete'}
        >
          {showForm ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
          {showForm ? 'Cancel' : 'Add Athlete'}
        </button>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={loadAthletes} className="text-brand-700 text-sm font-medium mt-1 underline">
            Try again
          </button>
        </div>
      )}

      {/* Add Athlete Form */}
      {showForm && (
        <div className="border border-gray-200 p-4 mb-4">
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
                  placeholder="6'2&quot;"
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

      {/* Athletes Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-10 bg-gray-100" />
          ))}
        </div>
      ) : athletes.length === 0 ? (
        <div className="border border-gray-200 text-center py-12 px-4">
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
            Add Athlete
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-wrap-inner">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} className={sortKey === 'name' ? 'sorted' : ''}>
                    Name<SortIcon col="name" />
                  </th>
                  <th onClick={() => handleSort('number')} className={sortKey === 'number' ? 'sorted' : ''}>
                    #<SortIcon col="number" />
                  </th>
                  <th onClick={() => handleSort('class')} className={sortKey === 'class' ? 'sorted' : ''}>
                    Class<SortIcon col="class" />
                  </th>
                  <th onClick={() => handleSort('fgpct')} className={sortKey === 'fgpct' ? 'sorted' : ''}>
                    FG%<SortIcon col="fgpct" />
                  </th>
                  <th onClick={() => handleSort('kicks')} className={sortKey === 'kicks' ? 'sorted' : ''}>
                    Kicks<SortIcon col="kicks" />
                  </th>
                  <th onClick={() => handleSort('longest')} className={sortKey === 'longest' ? 'sorted' : ''}>
                    Long<SortIcon col="longest" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAthletes.map((athlete) => (
                  <tr
                    key={athlete.id}
                    className="clickable"
                    onClick={() => navigate(`/athletes/${athlete.id}`)}
                  >
                    <td className="font-medium">
                      {athlete.first_name} {athlete.last_name}
                    </td>
                    <td className="font-mono text-gray-500">
                      {athlete.number ? `#${athlete.number}` : '—'}
                    </td>
                    <td className="text-gray-500">
                      {athlete.class_year || '—'}
                    </td>
                    <td className="font-mono font-bold">
                      {formatPercentage(athlete.total_makes, athlete.total_kicks)}
                    </td>
                    <td className="font-mono">
                      {athlete.total_kicks}
                    </td>
                    <td className="font-mono">
                      {athlete.longest_make ? `${athlete.longest_make}yd` : '—'}
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
