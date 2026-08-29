import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const CENTER = [-75.900, 40.1865]
const DEFAULT_ZOOM = 15
const SOURCE_ID = 'units'
const LAYER_ID = 'units-circles'
const HOVER_LAYER_ID = 'units-circles-hover'
const SELECTED_LAYER_ID = 'units-circles-selected'
const LABEL_LAYER_ID = 'units-labels'
const URGENT_RING_LAYER_ID = 'units-urgent-ring'

// Bounding box that keeps the user near the HOA — allows surrounding roads
// but prevents wandering across Pennsylvania
const MAX_BOUNDS = [[-75.105, 40.175], [-75.065, 40.205]]

const STATUS_COLOR_EXPR = [
  'match', ['get', 'status'],
  'needs_work', '#ef4444',
  'in_progress', '#eab308',
  'completed', '#22c55e',
  '#60a5fa',
]

// Selecting a unit (dot click or address search) bumps its dot up a bit,
// keeps its status color + urgency ring, and fades everything else back so
// the worked-on unit stands out. The selected unit's number label stays at
// full strength so it's still readable. `addr` is a full_address string or ''.
function applySelectionStyles(map, addr) {
  if (!map.getLayer(SELECTED_LAYER_ID)) return
  const sel = addr || ''
  const active = !!addr
  map.setFilter(SELECTED_LAYER_ID, ['==', ['get', 'full_address'], sel])

  const dim = (match, rest) => (active ? ['case', ['==', ['get', 'full_address'], sel], match, rest] : match)
  map.setPaintProperty(LAYER_ID, 'circle-opacity', dim(0.9, 0.15))
  map.setPaintProperty(LABEL_LAYER_ID, 'text-opacity', dim(1, 0.15))
  map.setPaintProperty(URGENT_RING_LAYER_ID, 'circle-stroke-opacity', dim(1, 0.15))
}

function addMapLayers(map, unitsRef, hoveredAddrRef, onSelectUnitRef, selectedAddrRef) {
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: unitsToGeoJSON(unitsRef.current),
    generateId: false,
  })

  map.addLayer({
    id: URGENT_RING_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['in', ['get', 'ring_priority'], ['literal', ['medium', 'urgent']]],
    paint: {
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': ['match', ['get', 'ring_priority'], 'urgent', '#eab308', '#ffffff'],
      'circle-stroke-width': 5,
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        13, 5,
        14, 6,
        15, 7,
        17, 13,
        19, 20,
      ],
    },
  })

  map.addLayer({
    id: LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-color': STATUS_COLOR_EXPR,
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        13, 2,
        14, 3,
        15, 4,
        17, 10,
        19, 16,
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(255,255,255,0.6)',
      'circle-opacity': 0.9,
    },
  })

  map.addLayer({
    id: HOVER_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-color': STATUS_COLOR_EXPR,
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        13, 3,
        14, 5,
        15, 6,
        17, 13,
        19, 19,
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 1,
    },
    filter: ['==', ['get', 'full_address'], ''],
  })

  // The selected unit's dot — a modest bump over the hover size, ringed in
  // white and drawn on top so it reads as "this is the one open in the
  // side panel". The address label still renders over it at full opacity.
  map.addLayer({
    id: SELECTED_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['get', 'full_address'], ''],
    paint: {
      'circle-color': STATUS_COLOR_EXPR,
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        13, 5,
        15, 9,
        17, 15,
        19, 22,
      ],
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 1,
    },
  })

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'text-field': ['get', 'addr_num'],
      'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
      'text-size': ['step', ['zoom'], 0, 17.5, 9, 19, 12],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': 'rgba(0,0,0,0.75)',
      'text-halo-width': 1,
    },
  })

  map.on('mousemove', LAYER_ID, (e) => {
    map.getCanvas().style.cursor = 'pointer'
    const addr = e.features[0]?.properties?.full_address
    if (addr && addr !== hoveredAddrRef.current) {
      hoveredAddrRef.current = addr
      map.setFilter(HOVER_LAYER_ID, ['==', ['get', 'full_address'], addr])
    }
  })

  map.on('mouseleave', LAYER_ID, () => {
    map.getCanvas().style.cursor = ''
    hoveredAddrRef.current = null
    map.setFilter(HOVER_LAYER_ID, ['==', ['get', 'full_address'], ''])
  })

  const handleUnitClick = (e) => {
    const addr = e.features[0]?.properties?.full_address
    if (addr) onSelectUnitRef.current(addr)
  }
  map.on('click', LAYER_ID, handleUnitClick)
  map.on('click', LABEL_LAYER_ID, handleUnitClick)

  // Re-apply the current selection after a fresh layer build (initial load
  // and every style swap, which wipes custom layers).
  applySelectionStyles(map, selectedAddrRef.current)
}

// The map needs one color + one ring per dot, but priority now lives on
// however many open tasks a unit has — so we collapse them here to whichever
// is worse: urgent beats medium beats low (low/no open tasks = no ring).
function ringPriorityFor(unit) {
  const openPriorities = (unit.projects || [])
    .filter((p) => p.status === 'open')
    .map((p) => p.priority)
  if (openPriorities.includes('urgent')) return 'urgent'
  if (openPriorities.includes('medium')) return 'medium'
  return 'low'
}

function unitsToGeoJSON(units) {
  return {
    type: 'FeatureCollection',
    features: units
      .filter((u) => u.lat != null && u.lon != null)
      .map((u) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [u.lon, u.lat] },
        properties: {
          id: u.id,
          full_address: u.full_address,
          street_name: u.street_name || '',
          status: u.status,
          ring_priority: ringPriorityFor(u),
          addr_num: u.full_address?.split(' ')[0] || '',
        },
      })),
  }
}

export default function MapView({
  units,
  activeFilter,
  selectedAddress,
  onSelectUnit,
  mapStyle,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const hoveredAddrRef = useRef(null)
  const unitsRef = useRef(units)
  // Kept in refs so the once-registered map event handlers always see the
  // latest values without re-binding listeners.
  const onSelectUnitRef = useRef(onSelectUnit)
  const selectedAddrRef = useRef(selectedAddress)
  // Prevents the mapStyle effect from calling setStyle on the initial render,
  // which would cancel the in-progress map load and drop the first data update.
  const mapStyleReady = useRef(false)
  // Gates the selection effect until layers exist — otherwise selecting a
  // unit before the map finishes loading would silently do nothing.
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => { unitsRef.current = units }, [units])
  useEffect(() => { onSelectUnitRef.current = onSelectUnit }, [onSelectUnit])
  useEffect(() => { selectedAddrRef.current = selectedAddress }, [selectedAddress])

  // Initialize map once
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 15,
      maxZoom: 19,
      maxBounds: MAX_BOUNDS,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
    map.addControl(new mapboxgl.ScaleControl(), 'bottom-left')

    map.on('load', () => {
      addMapLayers(map, unitsRef, hoveredAddrRef, onSelectUnitRef, selectedAddrRef)

      // Click on empty map = clear selection (closes the side panel)
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID, LABEL_LAYER_ID] })
        if (!features.length) onSelectUnitRef.current(null)
      })

      setMapReady(true)
    })

    // The side panel mounts/unmounts next to the map, changing its width.
    // Mapbox doesn't watch its container, so nudge it on every resize.
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    mapRef.current = map
    return () => {
      ro.disconnect()
      map.remove()
    }
  }, [])

  // Update source data when units change.
  // Checks that the source exists rather than isStyleLoaded() — the latter can
  // return false during the style-reload window and silently drop the update.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(SOURCE_ID)
    if (source) source.setData(unitsToGeoJSON(units))
  }, [units])

  // Apply/remove filter when activeFilter changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const filter = activeFilter ? ['==', ['get', 'status'], activeFilter] : null
    map.setFilter(LAYER_ID, filter)
    map.setFilter(LABEL_LAYER_ID, filter)
    const hasRingExpr = ['in', ['get', 'ring_priority'], ['literal', ['medium', 'urgent']]]
    const ringFilter = activeFilter
      ? ['all', hasRingExpr, ['==', ['get', 'status'], activeFilter]]
      : hasRingExpr
    map.setFilter(URGENT_RING_LAYER_ID, ringFilter)
  }, [activeFilter])

  // Selection: grow the chosen dot, fade the rest, and center the map on it.
  // Same path for a dot click and an address search — both just change
  // selectedAddress. Nothing moves when selection clears (panel close).
  // `units` is in the deps so a selection made before the data lands still
  // gets its highlight + recenter once the units arrive.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    applySelectionStyles(map, selectedAddress || '')

    if (!selectedAddress) return
    const unit = units.find((u) => u.full_address === selectedAddress)
    if (!unit || unit.lon == null || unit.lat == null) return
    // resize() first so the camera targets the map's post-panel width — it
    // forces a synchronous reflow, so the new flex layout is already applied.
    map.resize()
    // zoom to at least 18 so the address-number labels (which only render
    // past 17.5) are legible on the unit you just opened.
    const target = { center: [unit.lon, unit.lat], zoom: Math.max(map.getZoom(), 18) }
    // flyTo is RAF-animated and stalls while the tab is hidden; jump instead
    // so a background search still lands centered when the user comes back.
    if (document.hidden) map.jumpTo(target)
    else map.flyTo({ ...target, duration: 700 })
  }, [selectedAddress, mapReady, units])

  // Toggle map style — skips the initial render so it doesn't call setStyle
  // while the map is already loading its default style.
  useEffect(() => {
    if (!mapStyleReady.current) {
      mapStyleReady.current = true
      return
    }
    const map = mapRef.current
    if (!map) return
    const styleUrl = mapStyle === 'satellite'
      ? 'mapbox://styles/mapbox/satellite-streets-v12'
      : 'mapbox://styles/mapbox/streets-v12'

    // Re-add layers after style change
    map.once('style.load', () => {
      addMapLayers(map, unitsRef, hoveredAddrRef, onSelectUnitRef, selectedAddrRef)
    })
    map.setStyle(styleUrl)
  }, [mapStyle])

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full" />
  )
}
