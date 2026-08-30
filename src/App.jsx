import { useState, useCallback, useMemo } from 'react'
import MapView from './components/MapView'
import StatsPanel from './components/StatsPanel'
import UnitPopup from './components/UnitPopup'
import { useUnits } from './hooks/useUnits'

export default function App() {
  const { units, loading, error, updateUnit, addProject, updateProject, deleteProject } = useUnits()
  const [activeFilter, setActiveFilter] = useState(null)
  // The unit open in the side panel, keyed by full_address (stable — a unit
  // has no id until its first save). Derive the live unit object each render
  // so the panel always sees fresh data after a save.
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [mapStyle, setMapStyle] = useState('streets')
  // Task-type search filters (e.g. ['bathroom', 'kitchen']). AND logic: a
  // unit must have every one of these as an OPEN task to stay on the map.
  const [taskFilters, setTaskFilters] = useState([])

  const selectedUnit = selectedAddress
    ? units.find((u) => u.full_address === selectedAddress) || null
    : null

  // Addresses of units matching ALL active task filters (open tasks only).
  // null = no task filtering; [] = filtering active but nothing matches.
  const taskMatchAddresses = useMemo(() => {
    if (taskFilters.length === 0) return null
    return units
      .filter((u) => {
        const openTasks = new Set(
          (u.projects || []).filter((p) => p.status === 'open').map((p) => p.task)
        )
        return taskFilters.every((t) => openTasks.has(t))
      })
      .map((u) => u.full_address)
  }, [units, taskFilters])

  const handleSearch = useCallback((query) => {
    if (!query) return
    const q = query.toLowerCase()
    const match = units.find((u) =>
      u.full_address?.toLowerCase().includes(q) ||
      u.street_name?.toLowerCase().includes(q)
    )
    if (match) setSelectedAddress(match.full_address)
  }, [units])

  return (
    <div className="flex w-full h-screen overflow-hidden bg-slate-900">
      {/* Map column — shrinks when the side panel is open */}
      <div className="relative flex-1 min-w-0">
        <MapView
          units={units}
          activeFilter={activeFilter}
          taskMatchAddresses={taskMatchAddresses}
          selectedAddress={selectedAddress}
          onSelectUnit={setSelectedAddress}
          mapStyle={mapStyle}
        />

        {/* Stats / legend panel */}
        <StatsPanel
          units={units}
          loading={loading}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onSearch={handleSearch}
          onAddressSelect={(unit) => setSelectedAddress(unit.full_address)}
          taskFilters={taskFilters}
          onTaskFiltersChange={setTaskFilters}
          taskMatchCount={taskMatchAddresses?.length ?? null}
        />

        {/* Map style toggle */}
        <div
          className="absolute top-4 right-4 z-20 flex rounded-xl overflow-hidden shadow-xl border border-white/10"
          style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)' }}
        >
          {['streets', 'satellite'].map((style) => (
            <button
              key={style}
              onClick={() => setMapStyle(style)}
              className={`px-4 py-2 text-xs font-semibold capitalize transition-all
                ${mapStyle === style
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
            >
              {style}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 bg-red-900/90 text-red-200
                          text-sm px-4 py-2 rounded-lg shadow-xl border border-red-700/50 max-w-sm text-center">
            Error: {error}
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30
                          flex items-center gap-2 bg-slate-900/90 text-slate-300
                          text-sm px-4 py-2 rounded-lg shadow-xl border border-white/10">
            <svg className="animate-spin w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Loading units…
          </div>
        )}
      </div>

      {/* Unit detail — fixed full-height panel down the right side, replaces
          the old map-anchored popup. Renders only when a unit is selected. */}
      {selectedUnit && (
        <aside
          className="w-[400px] flex-shrink-0 h-full overflow-y-auto border-l border-white/10 shadow-2xl z-30"
          style={{ background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(12px)' }}
        >
          <UnitPopup
            unit={selectedUnit}
            onClose={() => setSelectedAddress(null)}
            onSave={updateUnit}
            onAddProject={addProject}
            onUpdateProject={updateProject}
            onDeleteProject={deleteProject}
          />
        </aside>
      )}
    </div>
  )
}
