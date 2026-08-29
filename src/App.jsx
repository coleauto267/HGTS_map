import { useState, useCallback } from 'react'
import MapView from './components/MapView'
import StatsPanel from './components/StatsPanel'
import { useUnits } from './hooks/useUnits'

export default function App() {
  const { units, loading, error, updateUnit, addProject, updateProject } = useUnits()
  const [activeFilter, setActiveFilter] = useState(null)
  const [searchTarget, setSearchTarget] = useState(null)
  const [mapStyle, setMapStyle] = useState('streets')

  const handleSearch = useCallback((query) => {
    if (!query) return
    const q = query.toLowerCase()
    const match = units.find((u) =>
      u.full_address?.toLowerCase().includes(q) ||
      u.street_name?.toLowerCase().includes(q)
    )
    if (match) setSearchTarget(match)
  }, [units])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900">
      {/* Full-screen map */}
      <MapView
        units={units}
        activeFilter={activeFilter}
        searchTarget={searchTarget}
        onSearchConsumed={() => setSearchTarget(null)}
        onUnitUpdate={updateUnit}
        onAddProject={addProject}
        onUpdateProject={updateProject}
        mapStyle={mapStyle}
      />

      {/* Stats / legend panel */}
      <StatsPanel
        units={units}
        loading={loading}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onSearch={handleSearch}
        onAddressSelect={setSearchTarget}
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
  )
}
