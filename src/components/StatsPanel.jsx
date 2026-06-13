import { useState, useMemo } from 'react'

const STATUS_CONFIG = [
  { value: 'needs_work', label: 'Needs Work', color: '#ef4444', dot: 'bg-red-500' },
  { value: 'in_progress', label: 'In Progress', color: '#eab308', dot: 'bg-yellow-500' },
  { value: 'completed', label: 'Completed', color: '#22c55e', dot: 'bg-green-500' },
  { value: 'none', label: 'No Status', color: '#94a3b8', dot: 'bg-slate-400' },
]

export default function StatsPanel({ units, activeFilter, onFilterChange, onSearch, loading }) {
  const [searchValue, setSearchValue] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const counts = useMemo(() => {
    const c = { none: 0, needs_work: 0, in_progress: 0, completed: 0 }
    units.forEach((u) => {
      if (c[u.status] !== undefined) c[u.status]++
    })
    return c
  }, [units])

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
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
          {/* Search */}
          <div className="px-3 py-2 border-b border-white/10">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchValue}
                onChange={handleSearchInput}
                placeholder="Search address…"
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
            </form>
          </div>

          {/* Legend / Stats */}
          <div className="p-3 space-y-1">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">
              Units by Status
              {activeFilter && (
                <button
                  onClick={() => onFilterChange(null)}
                  className="ml-2 text-blue-400 hover:text-blue-300 normal-case tracking-normal font-normal"
                >
                  Clear filter
                </button>
              )}
            </p>

            {loading ? (
              <p className="text-slate-500 text-xs py-2">Loading units…</p>
            ) : (
              STATUS_CONFIG.map(({ value, label, dot }) => {
                const isActive = activeFilter === value
                const isFiltered = activeFilter !== null && !isActive
                return (
                  <button
                    key={value}
                    onClick={() => onFilterChange(isActive ? null : value)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg
                                text-sm transition-all text-left
                                ${isActive ? 'bg-white/15 ring-1 ring-white/20' : 'hover:bg-white/10'}
                                ${isFiltered ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                      <span className="text-slate-200 text-xs">{label}</span>
                    </div>
                    <span className="text-slate-400 text-xs font-mono font-medium">
                      {counts[value]}
                    </span>
                  </button>
                )
              })
            )}

            {!loading && (
              <div className="pt-1 mt-1 border-t border-white/10 flex justify-between px-2.5 text-xs text-slate-500">
                <span>Total</span>
                <span className="font-mono">{units.length}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
