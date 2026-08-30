import { useState, useMemo } from 'react'
import { TASK_OPTIONS } from '../constants'

const STATUS_CONFIG = [
  {
    value: 'needs_work', label: 'Needs Work', color: '#ef4444', dot: 'bg-red-500',
    active: 'bg-red-500/15 border-red-500/60 ring-1 ring-red-500/30',
  },
  {
    value: 'in_progress', label: 'In Progress', color: '#eab308', dot: 'bg-yellow-500',
    active: 'bg-yellow-500/15 border-yellow-500/60 ring-1 ring-yellow-500/30',
  },
  {
    value: 'completed', label: 'Completed', color: '#22c55e', dot: 'bg-green-500',
    active: 'bg-green-500/15 border-green-500/60 ring-1 ring-green-500/30',
  },
  {
    value: 'none', label: 'No Status', color: '#60a5fa', dot: 'bg-blue-400',
    active: 'bg-blue-400/15 border-blue-400/60 ring-1 ring-blue-400/30',
  },
]

const LISTABLE_STATUSES = ['needs_work', 'in_progress', 'completed']

export default function StatsPanel({
  units,
  activeFilter,
  onFilterChange,
  onSearch,
  onAddressSelect,
  loading,
  taskFilters = [],
  onTaskFiltersChange,
  taskMatchCount = null,
}) {
  const [searchValue, setSearchValue] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Task-type suggestions for what's currently typed — prefix match against
  // the fixed list, excluding ones already added as filters.
  const taskSuggestions = useMemo(() => {
    const q = searchValue.trim().toLowerCase()
    if (!q) return []
    return TASK_OPTIONS.filter((t) => t.startsWith(q) && !taskFilters.includes(t))
  }, [searchValue, taskFilters])

  const addTaskFilter = (task) => {
    onTaskFiltersChange?.([...taskFilters, task])
    setSearchValue('')
  }
  const removeTaskFilter = (task) => {
    onTaskFiltersChange?.(taskFilters.filter((t) => t !== task))
  }

  const counts = useMemo(() => {
    const c = { none: 0, needs_work: 0, in_progress: 0, completed: 0 }
    units.forEach((u) => {
      if (c[u.status] !== undefined) c[u.status]++
    })
    return c
  }, [units])

  const filteredUnits = useMemo(() => {
    if (!LISTABLE_STATUSES.includes(activeFilter)) return []
    return units
      .filter((u) => u.status === activeFilter)
      .sort((a, b) => a.full_address.localeCompare(b.full_address, undefined, { numeric: true }))
  }, [units, activeFilter])

  const handleSearch = (e) => {
    e.preventDefault()
    onSearch(searchValue.trim())
  }

  const handleSearchInput = (e) => {
    setSearchValue(e.target.value)
    if (e.target.value === '') onSearch('')
  }

  return (
    <div
      className="absolute top-4 left-4 z-20 w-64 rounded-xl shadow-2xl border border-white/10 overflow-hidden"
      style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-white/25">
        <div>
          <h1 className="text-white font-bold text-sm leading-tight">
            Warminster Heights
          </h1>
          <p className="text-slate-400 text-xs">Maintenance Map</p>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-slate-400 hover:text-white transition-colors ml-2"
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Search — address free-text (Go) plus task-type filter chips */}
          <div className="px-3 py-2 border-b-2 border-white/25">
            <form onSubmit={handleSearch} className="relative flex gap-2">
              <input
                type="text"
                value={searchValue}
                onChange={handleSearchInput}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                placeholder="Address, or task (e.g. bath…)"
                className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg
                           px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500
                           placeholder-slate-600 min-w-0"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5
                           rounded-lg transition-colors flex-shrink-0"
              >
                Go
              </button>

              {/* Task suggestions — click one to add it as a filter */}
              {searchFocused && taskSuggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-slate-700
                               bg-slate-800 shadow-xl overflow-hidden">
                  {taskSuggestions.map((task) => (
                    <li key={task}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addTaskFilter(task)}
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-200 capitalize
                                   hover:bg-blue-600/30 transition-colors cursor-pointer"
                      >
                        {task}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </form>

            {/* Active task filters (AND logic) */}
            {taskFilters.length > 0 && (
              <>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {taskFilters.map((task) => (
                    <span
                      key={task}
                      className="inline-flex items-center gap-1 rounded-md border border-blue-500/40
                                 bg-blue-600/20 pl-2 pr-1 py-0.5 text-xs text-blue-100 capitalize"
                    >
                      {task}
                      <button
                        type="button"
                        onClick={() => removeTaskFilter(task)}
                        aria-label={`Remove ${task} filter`}
                        className="text-blue-300 hover:text-white transition-colors cursor-pointer leading-none"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {taskMatchCount ?? 0} propert{taskMatchCount === 1 ? 'y' : 'ies'} with all selected tasks open
                </p>
              </>
            )}
          </div>

          {/* Legend / Stats */}
          <div className="p-3 space-y-1.5">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">
              Filter by Status
            </p>

            {loading ? (
              <p className="text-slate-500 text-xs py-2">Loading units…</p>
            ) : (
              <>
                <button
                  onClick={() => onFilterChange(null)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg
                              border text-sm transition-all text-left cursor-pointer
                              ${activeFilter === null
                                ? 'bg-white/15 border-white/40 ring-1 ring-white/20'
                                : 'border-white/10 hover:border-white/25 hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-2">
                    {activeFilter === null && (
                      <svg className="w-3.5 h-3.5 text-white flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="text-slate-200 text-xs font-medium">All Units</span>
                  </div>
                  <span className="text-slate-400 text-xs font-mono font-medium">
                    {units.length}
                  </span>
                </button>

                {STATUS_CONFIG.map(({ value, label, dot, active }) => {
                  const isActive = activeFilter === value
                  const isDimmed = activeFilter !== null && !isActive
                  return (
                    <button
                      key={value}
                      onClick={() => onFilterChange(isActive ? null : value)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg
                                  border text-sm transition-all text-left cursor-pointer
                                  ${isActive
                                    ? active
                                    : 'border-white/10 hover:border-white/25 hover:bg-white/5'}
                                  ${isDimmed ? 'opacity-40 hover:opacity-70' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        {isActive ? (
                          <svg className="w-3.5 h-3.5 text-white flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                        )}
                        <span className="text-slate-200 text-xs">{label}</span>
                      </div>
                      <span className="text-slate-400 text-xs font-mono font-medium">
                        {counts[value]}
                      </span>
                    </button>
                  )
                })}
              </>
            )}

            {!loading && (
              <div className="pt-1 mt-1 border-t-2 border-white/25 flex justify-between px-2.5 text-xs text-slate-500">
                <span>Total</span>
                <span className="font-mono">{units.length}</span>
              </div>
            )}

            {!loading && LISTABLE_STATUSES.includes(activeFilter) && (
              <div className="pt-2 mt-1 border-t-2 border-white/25">
                <p className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-1.5 px-0.5">
                  Addresses ({filteredUnits.length})
                </p>
                <ul className="address-list-scroll max-h-48 overflow-y-auto space-y-0.5">
                  {filteredUnits.map((unit) => (
                    <li key={unit.id ?? unit.full_address}>
                      <button
                        onClick={() => onAddressSelect(unit)}
                        title={unit.full_address}
                        className="w-full text-left text-slate-300 text-xs px-2.5 py-1 rounded-md
                                   hover:bg-white/10 hover:text-white transition-colors truncate cursor-pointer"
                      >
                        {unit.full_address}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
