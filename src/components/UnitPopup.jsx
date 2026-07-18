import { useState, useEffect } from 'react'
import { IconLayoutSidebar, IconLayoutSidebarRight } from '@tabler/icons-react'

const STATUS_OPTIONS = [
  { value: 'none', label: 'No Status' },
  { value: 'needs_work', label: 'Needs Work' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

// Solid pill used for the read-only "current status" badge
const STATUS_BUTTON = {
  none:        'bg-blue-400 hover:bg-blue-300 text-white',
  needs_work:  'bg-red-500 hover:bg-red-400 text-white',
  in_progress: 'bg-yellow-500 hover:bg-yellow-400 text-black',
  completed:   'bg-green-500 hover:bg-green-400 text-white',
}

// Interactive status buttons: muted/outlined when unselected, colored + ring when selected
// (mirrors the filter-chip pattern in StatsPanel so selection state is unambiguous)
const STATUS_CHIP = {
  none: {
    dot: 'bg-blue-400',
    active: 'bg-blue-400/20 border-blue-400/70 ring-1 ring-blue-400/40 text-white',
  },
  needs_work: {
    dot: 'bg-red-500',
    active: 'bg-red-500/20 border-red-500/70 ring-1 ring-red-500/40 text-white',
  },
  in_progress: {
    dot: 'bg-yellow-500',
    active: 'bg-yellow-500/20 border-yellow-500/70 ring-1 ring-yellow-500/40 text-white',
  },
  completed: {
    dot: 'bg-green-500',
    active: 'bg-green-500/20 border-green-500/70 ring-1 ring-green-500/40 text-white',
  },
}

const STATUS_CHIP_INACTIVE =
  'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'

const STATUS_LABELS = {
  none: 'No Status',
  needs_work: 'Needs Work',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export default function UnitPopup({ unit, onClose, onSave }) {
  const [status, setStatus] = useState(unit.status)
  const [notes, setNotes] = useState(unit.notes || '')
  const [isUrgent, setIsUrgent] = useState(unit.is_urgent || false)
  const [occupant, setOccupant] = useState(unit.occupant || '')
  const [phone, setPhone] = useState(unit.phone || '')
  const [email, setEmail] = useState(unit.email || '')
  const [universalKey, setUniversalKey] = useState(unit.universal_key || false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeView, setActiveView] = useState('status')

  useEffect(() => {
    setStatus(unit.status)
    setNotes(unit.notes || '')
    setIsUrgent(unit.is_urgent || false)
    setOccupant(unit.occupant || '')
    setPhone(unit.phone || '')
    setEmail(unit.email || '')
    setUniversalKey(unit.universal_key || false)
    setSaved(false)
    setActiveView('status')
  }, [unit.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(unit, {
        status,
        notes,
        is_urgent: isUrgent,
        occupant,
        phone,
        email,
        universal_key: universalKey,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = 'w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-600'

  return (
    <div className="w-96 rounded-xl overflow-hidden shadow-2xl"
         style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)' }}>
      {/* Header spans the full width of the card */}
      <div className="flex items-start justify-between p-3 pb-2 border-b-2 border-white/30">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-bold text-lg leading-tight truncate">
              {unit.full_address}
            </h3>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_BUTTON[status]}`}>
              {STATUS_LABELS[status]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveView((v) => (v === 'status' ? 'details' : 'status'))}
            className="mt-0.5 text-slate-500 hover:text-white transition-colors cursor-pointer"
            aria-label="Switch view"
          >
            {activeView === 'status'
              ? <IconLayoutSidebarRight className="w-5 h-5" stroke={2} />
              : <IconLayoutSidebar className="w-5 h-5" stroke={2} />}
          </button>
          <button
            onClick={onClose}
            className="mt-0.5 text-slate-500 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body: single column, stacked top to bottom. Fixed min-height so toggling views never resizes the card. */}
      <div className="p-3 space-y-3 min-h-[22rem]">
        {activeView === 'status' && (
          <>
            {/* Status buttons: one row across the full width */}
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">
                Set Status
              </label>
              <div className="grid grid-cols-4 gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const isActive = status === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className={`flex flex-col items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-xs font-semibold border
                        transition-all cursor-pointer text-center leading-tight
                        ${isActive ? STATUS_CHIP[opt.value].active : STATUS_CHIP_INACTIVE}`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CHIP[opt.value].dot}`} />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Urgency toggle */}
            <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors
              ${isUrgent ? 'bg-red-500/15 border-red-500/40' : 'border-white/10'}`}>
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span className="text-white text-sm flex-1">Mark as Urgent</span>
              <button
                onClick={() => setIsUrgent((v) => !v)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isUrgent ? 'bg-red-500' : 'bg-slate-600'}`}
                role="switch"
                aria-checked={isUrgent}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${isUrgent ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Notes: compressed to a couple of rows now that everything stacks */}
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1.5 uppercase tracking-wider">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add maintenance notes..."
                className={`${fieldClass} resize-none`}
              />
            </div>
          </>
        )}

        {activeView === 'details' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1.5 uppercase tracking-wider">
                Occupant
              </label>
              <input
                type="text"
                value={occupant}
                onChange={(e) => setOccupant(e.target.value)}
                placeholder="Owner or tenant name"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1.5 uppercase tracking-wider">
                Phone #
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="267-000-0000"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={fieldClass}
              />
            </div>

            {/* Universal Key */}
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">
                Universal Key
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setUniversalKey(true)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer
                    ${universalKey
                      ? 'bg-green-500/20 border-green-500/70 ring-1 ring-green-500/40 text-white'
                      : STATUS_CHIP_INACTIVE}`}
                >
                  Yes
                </button>
                <button
                  onClick={() => setUniversalKey(false)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer
                    ${!universalKey
                      ? 'bg-red-500/20 border-red-500/70 ring-1 ring-red-500/40 text-white'
                      : STATUS_CHIP_INACTIVE}`}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save button: pinned as the last item, at the bottom of the card */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-2 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer
            ${saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
