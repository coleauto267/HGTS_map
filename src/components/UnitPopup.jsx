import { useState, useEffect, useRef } from 'react'
import { IconLayoutSidebar, IconLayoutSidebarRight, IconKey } from '@tabler/icons-react'

const STATUS_OPTIONS = [
  { value: 'none', label: 'No Status' },
  { value: 'needs_work', label: 'Needs Work' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

const JOB_TITLE_OPTIONS = ['Bathroom', 'Kitchen', 'Floor', 'Full Rehab']

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergency', label: 'Emergency' },
]

// Header status dropdown: solid pill colored per status, doubles as the "current status" badge
const STATUS_BUTTON = {
  none:        'bg-blue-400 hover:bg-blue-300 text-white',
  needs_work:  'bg-red-500 hover:bg-red-400 text-white',
  in_progress: 'bg-yellow-500 hover:bg-yellow-400 text-black',
  completed:   'bg-green-500 hover:bg-green-400 text-white',
}

// Urgency dropdown: colored dot per severity level
const URGENCY_DOT = {
  low:       'bg-slate-400',
  medium:    'bg-yellow-500',
  urgent:    'bg-orange-500',
  emergency: 'bg-red-500',
}

export default function UnitPopup({ unit, onClose, onSave }) {
  const [status, setStatus] = useState(unit.status)
  const [notes, setNotes] = useState(unit.notes || '')
  const [urgency, setUrgency] = useState(unit.urgency || 'low')
  const [occupant, setOccupant] = useState(unit.occupant || '')
  const [phone, setPhone] = useState(unit.phone || '')
  const [email, setEmail] = useState(unit.email || '')
  const [universalKey, setUniversalKey] = useState(unit.universal_key || false)
  const [jobTitles, setJobTitles] = useState(unit.job_title || [])
  const [jobTitleMenuOpen, setJobTitleMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeView, setActiveView] = useState('status')
  const jobTitleRef = useRef(null)

  useEffect(() => {
    setStatus(unit.status)
    setNotes(unit.notes || '')
    setUrgency(unit.urgency || 'low')
    setOccupant(unit.occupant || '')
    setPhone(unit.phone || '')
    setEmail(unit.email || '')
    setUniversalKey(unit.universal_key || false)
    setJobTitles(unit.job_title || [])
    setJobTitleMenuOpen(false)
    setSaved(false)
    setActiveView('status')
  }, [unit.id])

  useEffect(() => {
    if (!jobTitleMenuOpen) return
    const handleClickOutside = (e) => {
      if (jobTitleRef.current && !jobTitleRef.current.contains(e.target)) {
        setJobTitleMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [jobTitleMenuOpen])

  const toggleJobTitle = (title) => {
    setJobTitles((prev) => prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(unit, {
        status,
        notes,
        urgency,
        occupant,
        phone,
        email,
        universal_key: universalKey,
        job_title: jobTitles,
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
    <div className="w-96 rounded-xl shadow-2xl"
         style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)' }}>
      {/* Header spans the full width of the card */}
      <div className="flex items-start justify-between p-3 pb-2 border-b-2 border-white/30">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-bold text-lg leading-tight truncate">
              {unit.full_address}
            </h3>
            <div className="relative inline-flex flex-shrink-0">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={`appearance-none pl-2.5 pr-5 py-0.5 rounded-full text-xs font-semibold cursor-pointer border-0
                  focus:outline-none focus:ring-2 focus:ring-blue-500 ${STATUS_BUTTON[status]}`}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-800 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
              <svg className={`pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 ${status === 'in_progress' ? 'text-black' : 'text-white'}`}
                   fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Universal Key: icon-only toggle, red = no key, green = has key */}
          <button
            onClick={() => setUniversalKey((v) => !v)}
            className={`mt-0.5 transition-colors cursor-pointer ${universalKey ? 'text-green-500 hover:text-green-400' : 'text-red-500 hover:text-red-400'}`}
            aria-label={universalKey ? 'Universal key: yes' : 'Universal key: no'}
          >
            <IconKey className="w-5 h-5" stroke={2} />
          </button>
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
      <div className="p-3 space-y-3 min-h-[17.5rem]">
        {activeView === 'status' && (
          <div className="space-y-3">
            {/* Job Title: multi-select dropdown, second most important field after the address */}
            <div ref={jobTitleRef} className="relative">
              <label className="block text-xs text-slate-400 font-medium mb-1.5 uppercase tracking-wider">
                Job Title
              </label>
              <button
                type="button"
                onClick={() => setJobTitleMenuOpen((v) => !v)}
                className={`${fieldClass} flex items-center justify-between gap-2 text-left cursor-pointer`}
              >
                <span className={`truncate ${jobTitles.length ? 'text-white' : 'text-slate-600'}`}>
                  {jobTitles.length ? jobTitles.join(', ') : 'Select job title...'}
                </span>
                <svg className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform ${jobTitleMenuOpen ? 'rotate-180' : ''}`}
                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {jobTitleMenuOpen && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border border-slate-700 bg-slate-800 shadow-lg overflow-hidden">
                  {JOB_TITLE_OPTIONS.map((title) => {
                    const checked = jobTitles.includes(title)
                    return (
                      <button
                        key={title}
                        type="button"
                        onClick={() => toggleJobTitle(title)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left cursor-pointer hover:bg-slate-700"
                      >
                        <span className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors
                          ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                          {checked && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className={checked ? 'text-white' : 'text-slate-300'}>{title}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Urgency: single-select dropdown */}
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1.5 uppercase tracking-wider">
                Urgency
              </label>
              <div className="relative">
                <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${URGENCY_DOT[urgency]}`} />
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className="w-full appearance-none bg-slate-800 border border-slate-700 text-white text-sm rounded-lg pl-7 pr-8 py-2
                    cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {URGENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-slate-800 text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
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
          </div>
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
