import { useState, useEffect } from 'react'

const STATUS_OPTIONS = [
  { value: 'none', label: 'No Status' },
  { value: 'needs_work', label: 'Needs Work' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

const STATUS_BUTTON = {
  none:        'bg-slate-500 hover:bg-slate-400 text-white',
  needs_work:  'bg-red-500 hover:bg-red-400 text-white',
  in_progress: 'bg-yellow-500 hover:bg-yellow-400 text-black',
  completed:   'bg-green-500 hover:bg-green-400 text-white',
}

const STATUS_RING = {
  none:        'ring-2 ring-offset-2 ring-offset-slate-950 ring-slate-300',
  needs_work:  'ring-2 ring-offset-2 ring-offset-slate-950 ring-red-300',
  in_progress: 'ring-2 ring-offset-2 ring-offset-slate-950 ring-yellow-300',
  completed:   'ring-2 ring-offset-2 ring-offset-slate-950 ring-green-300',
}

const STATUS_LABELS = {
  none: 'No Status',
  needs_work: 'Needs Work',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export default function UnitPopup({ unit, onClose, onSave }) {
  const [status, setStatus] = useState(unit.status)
  const [notes, setNotes] = useState(unit.notes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setStatus(unit.status)
    setNotes(unit.notes || '')
    setSaved(false)
  }, [unit.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(unit.id, { status, notes })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-72 rounded-xl overflow-hidden shadow-2xl border border-white/10"
         style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)' }}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-lg leading-tight truncate">
            {unit.full_address}
          </h3>
          <p className="text-slate-400 text-sm mt-0.5">
            {unit.street_name} &bull; {unit.post_code || '18974'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 mt-0.5 text-slate-500 hover:text-white transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status badge */}
      <div className="px-4 pb-3">
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Status buttons */}
        <div>
          <label className="block text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">
            Status
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all
                  ${STATUS_BUTTON[opt.value]}
                  ${status === opt.value ? STATUS_RING[opt.value] : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add maintenance notes..."
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       resize-none placeholder-slate-600"
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-2 px-4 rounded-lg text-sm font-semibold transition-all
            ${saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </button>

        {/* Parcel ID */}
        {unit.parcel_id && (
          <p className="text-slate-600 text-xs text-center">
            Parcel: {unit.parcel_id}
          </p>
        )}
      </div>
    </div>
  )
}
