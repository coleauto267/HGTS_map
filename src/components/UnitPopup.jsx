import { useState, useEffect } from 'react'
import { IconLayoutSidebar, IconLayoutSidebarRight, IconKey } from '@tabler/icons-react'

const STATUS_OPTIONS = [
  { value: 'none', label: 'No Status' },
  { value: 'needs_work', label: 'Needs Work' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

const TASK_OPTIONS = ['bathroom', 'kitchen', 'tub', 'cabinet', 'waterline', 'floor', 'beam']

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'urgent', label: 'Urgent' },
]

// Header status dropdown: solid pill colored per status, doubles as the "current status" badge
const STATUS_BUTTON = {
  none:        'bg-blue-400 hover:bg-blue-300 text-white',
  needs_work:  'bg-red-500 hover:bg-red-400 text-white',
  in_progress: 'bg-yellow-500 hover:bg-yellow-400 text-black',
  completed:   'bg-green-500 hover:bg-green-400 text-white',
}

// Priority dot in the task list — mirrors the map's ring colors (no ring/white/yellow)
const PRIORITY_DOT = {
  low:    'bg-slate-500',
  medium: 'bg-white',
  urgent: 'bg-yellow-400',
}

const fieldClass = 'w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-600'

const todayISO = () => new Date().toISOString().slice(0, 10)

// One task (project row): a collapsed punch-list line by default, expands to
// edit priority/notes and toggle done. Manages its own local edit state and
// saves independently of the rest of the card, since it writes to a
// different table (`projects`) than everything else in the popup.
function TaskRow({ project, expanded, onToggleExpand, onUpdate, onToggleDone }) {
  const [priority, setPriority] = useState(project.priority)
  const [notes, setNotes] = useState(project.notes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setPriority(project.priority)
    setNotes(project.notes || '')
    setSaved(false)
  }, [project.id, project.priority, project.notes])

  const isDone = project.status === 'done'

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate({ priority, notes })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      console.error('Task save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-700 overflow-hidden flex-shrink-0">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/70 hover:bg-slate-800">
        <input
          type="checkbox"
          checked={isDone}
          onChange={(e) => { e.stopPropagation(); onToggleDone(isDone) }}
          onClick={(e) => e.stopPropagation()}
          aria-label={isDone ? `Mark ${project.task} not done` : `Mark ${project.task} done`}
          className="cursor-pointer accent-blue-600 w-4 h-4 flex-shrink-0"
        />
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
        >
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[project.priority]}`} />
          <span className={`flex-1 text-sm capitalize truncate ${isDone ? 'line-through text-slate-500' : 'text-white'}`}>
            {project.task}
          </span>
          <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
               fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-2.5 border-t border-slate-700">
          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-2.5 py-1.5
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add notes for this task..."
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-2.5 py-1.5
                         resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-600"
            />
          </div>

          <div className="text-xs text-slate-500">
            Added {project.date_added || '—'}
            {project.date_completed ? ` · Completed ${project.date_completed}` : ''}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
              ${saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Task'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function UnitPopup({ unit, onClose, onSave, onAddProject, onUpdateProject }) {
  const [status, setStatus] = useState(unit.status)
  const [occupant, setOccupant] = useState(unit.occupant || '')
  const [phone, setPhone] = useState(unit.phone || '')
  const [email, setEmail] = useState(unit.email || '')
  const [universalKey, setUniversalKey] = useState(unit.universal_key || false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeView, setActiveView] = useState('status')
  const [expandedTaskId, setExpandedTaskId] = useState(null)
  const [addingTask, setAddingTask] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [newPriority, setNewPriority] = useState('low')
  const [newNotes, setNewNotes] = useState('')
  const [newDate, setNewDate] = useState(todayISO())
  const [addingSaving, setAddingSaving] = useState(false)

  useEffect(() => {
    setStatus(unit.status)
    setOccupant(unit.occupant || '')
    setPhone(unit.phone || '')
    setEmail(unit.email || '')
    setUniversalKey(unit.universal_key || false)
    setSaved(false)
    setActiveView('status')
    setExpandedTaskId(null)
    setAddingTask(false)
  }, [unit.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(unit, {
        status,
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

  const handleAddTask = async () => {
    if (!newTask) return
    setAddingSaving(true)
    try {
      await onAddProject(unit, {
        task: newTask,
        priority: newPriority,
        notes: newNotes,
        date_added: newDate,
      })
      setAddingTask(false)
      setNewTask('')
      setNewPriority('low')
      setNewNotes('')
      setNewDate(todayISO())
    } catch (err) {
      console.error('Add task failed:', err)
    } finally {
      setAddingSaving(false)
    }
  }

  const projects = unit.projects || []

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

      {/* Body: single column, stacked top to bottom. No longer a fixed height —
          the task list is inherently variable-length now. */}
      <div className="p-3 space-y-3">
        {activeView === 'status' && (
          <div className="space-y-3">
            {/* Task list: punch-list style, one collapsible row per project */}
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1.5 uppercase tracking-wider">
                Tasks
              </label>
              {projects.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-0.5">
                  {projects.map((project) => (
                    <TaskRow
                      key={project.id}
                      project={project}
                      expanded={expandedTaskId === project.id}
                      onToggleExpand={() => setExpandedTaskId((id) => (id === project.id ? null : project.id))}
                      onUpdate={(updates) => onUpdateProject(unit, project, updates)}
                      onToggleDone={(isDone) => onUpdateProject(unit, project, {
                        status: isDone ? 'open' : 'done',
                        date_completed: isDone ? null : todayISO(),
                      })}
                    />
                  ))}
                </div>
              )}

              {addingTask ? (
                <div className="rounded-lg border border-blue-500/50 bg-slate-800/50 p-3 space-y-2 mt-2">
                  <select
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-2.5 py-1.5
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select task type...</option>
                    {TASK_OPTIONS.map((t) => (
                      <option key={t} value={t} className="capitalize">{t}</option>
                    ))}
                  </select>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-2.5 py-1.5
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-2.5 py-1.5
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    rows={2}
                    placeholder="Notes (optional)"
                    className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-2.5 py-1.5
                               resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddTask}
                      disabled={!newTask || addingSaving}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500
                                 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      {addingSaving ? 'Adding…' : 'Add Task'}
                    </button>
                    <button
                      onClick={() => setAddingTask(false)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-slate-700
                                 text-slate-300 hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTask(true)}
                  className="w-full mt-2 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-slate-600
                             text-slate-400 hover:text-white hover:border-slate-400 transition-all cursor-pointer"
                >
                  + Add Task
                </button>
              )}
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

        {/* Save button: pinned as the last item — saves unit-level fields only
            (status/occupant/phone/email/key). Tasks save independently, above. */}
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
