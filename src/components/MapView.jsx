import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import ReactDOM from 'react-dom/client'
import UnitPopup from './UnitPopup'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const CENTER = [-75.0836, 40.1872]
const DEFAULT_ZOOM = 15
const SOURCE_ID = 'units'
const LAYER_ID = 'units-circles'
const HOVER_LAYER_ID = 'units-circles-hover'
const LABEL_LAYER_ID = 'units-labels'

// Bounding box that keeps the user near the HOA — allows surrounding roads
// but prevents wandering across Pennsylvania
const MAX_BOUNDS = [[-75.16, 40.12], [-75.00, 40.25]]

const STATUS_COLOR_EXPR = [
  'match', ['get', 'status'],
  'needs_work', '#ef4444',
  'in_progress', '#eab308',
  'completed', '#22c55e',
  '#60a5fa',
]

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
          parcel_id: u.parcel_id || '',
          status: u.status,
          notes: u.notes || '',
          addr_num: u.full_address?.split(' ')[0] || '',
        },
      })),
  }
}

export default function MapView({
  units,
  activeFilter,
  searchTarget,
  onSearchConsumed,
  onUnitUpdate,
  mapStyle,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const popupRef = useRef(null)
  const popupRootRef = useRef(null)
  const hoveredIdRef = useRef(null)
  const unitsRef = useRef(units)
  // Prevents the mapStyle effect from calling setStyle on the initial render,
  // which would cancel the in-progress map load and drop the first data update.
  const mapStyleReady = useRef(false)

  // Keep unitsRef in sync so popup callbacks always see latest data
  useEffect(() => {
    unitsRef.current = units
  }, [units])

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
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: unitsToGeoJSON(unitsRef.current),
        generateId: false,
      })

      // Main circle layer
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
            17, 8,
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.6)',
          'circle-opacity': 0.9,
        },
      })

      // Hover highlight layer (same source, filters to hovered feature)
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
            17, 11,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 1,
        },
        filter: ['==', ['get', 'id'], ''],
      })

      // Address number labels on top of circles
      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'addr_num'],
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': ['step', ['zoom'], 0, 16, 9, 17, 12],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.75)',
          'text-halo-width': 1,
        },
      })

      // Hover interactions
      map.on('mousemove', LAYER_ID, (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const id = e.features[0]?.properties?.id
        if (id && id !== hoveredIdRef.current) {
          hoveredIdRef.current = id
          map.setFilter(HOVER_LAYER_ID, ['==', ['get', 'id'], id])
        }
      })

      map.on('mouseleave', LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
        hoveredIdRef.current = null
        map.setFilter(HOVER_LAYER_ID, ['==', ['get', 'id'], ''])
      })

      // Click to open popup — listen on both circles and labels (labels sit on top)
      const handleUnitClick = (e) => {
        const props = e.features[0]?.properties
        if (!props) return
        const unit = unitsRef.current.find((u) =>
          u.id === props.id ||
          (!props.id && u.full_address === props.full_address)
        )
        if (!unit) return
        openPopup(map, unit, e.lngLat)
      }
      map.on('click', LAYER_ID, handleUnitClick)
      map.on('click', LABEL_LAYER_ID, handleUnitClick)

      // Close popup on background click
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID, LABEL_LAYER_ID] })
        if (!features.length) closePopup()
      })
    })

    mapRef.current = map
    return () => {
      closePopup()
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [activeFilter])

  // Fly to search target
  useEffect(() => {
    if (!searchTarget || !mapRef.current) return
    mapRef.current.flyTo({
      center: [searchTarget.lon, searchTarget.lat],
      zoom: 18,
      duration: 1200,
    })
    // Open popup after fly
    setTimeout(() => {
      if (mapRef.current) openPopup(mapRef.current, searchTarget, { lng: searchTarget.lon, lat: searchTarget.lat })
    }, 1300)
    onSearchConsumed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTarget])

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
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: unitsToGeoJSON(unitsRef.current),
      })
      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-color': STATUS_COLOR_EXPR,
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            13, 2, 14, 3, 15, 4, 17, 8,
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
            13, 3, 14, 5, 15, 6, 17, 11,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 1,
        },
        filter: ['==', ['get', 'id'], ''],
      })
      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'addr_num'],
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': ['step', ['zoom'], 0, 16, 9, 17, 12],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.75)',
          'text-halo-width': 1,
        },
      })
      // Re-bind events after style change
      map.on('mousemove', LAYER_ID, (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const id = e.features[0]?.properties?.id
        if (id && id !== hoveredIdRef.current) {
          hoveredIdRef.current = id
          map.setFilter(HOVER_LAYER_ID, ['==', ['get', 'id'], id])
        }
      })
      map.on('mouseleave', LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
        hoveredIdRef.current = null
        map.setFilter(HOVER_LAYER_ID, ['==', ['get', 'id'], ''])
      })
      const handleUnitClick = (e) => {
        const props = e.features[0]?.properties
        if (!props) return
        const unit = unitsRef.current.find((u) =>
          u.id === props.id ||
          (!props.id && u.full_address === props.full_address)
        )
        if (!unit) return
        openPopup(map, unit, e.lngLat)
      }
      map.on('click', LAYER_ID, handleUnitClick)
      map.on('click', LABEL_LAYER_ID, handleUnitClick)
    })
    map.setStyle(styleUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle])

  const closePopup = useCallback(() => {
    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }
    if (popupRootRef.current) {
      popupRootRef.current.unmount()
      popupRootRef.current = null
    }
  }, [])

  const openPopup = useCallback((map, unit, lngLat) => {
    closePopup()
    const container = document.createElement('div')
    const root = ReactDOM.createRoot(container)
    popupRootRef.current = root

    const renderPopup = (currentUnit) => {
      root.render(
        <UnitPopup
          unit={currentUnit}
          onClose={closePopup}
          onSave={async (unit, updates) => {
            const updated = await onUnitUpdate(unit, updates)
            renderPopup(updated)
          }}
        />
      )
    }
    renderPopup(unit)

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: 'none' })
      .setLngLat(lngLat)
      .setDOMContent(container)
      .addTo(map)

    popupRef.current = popup
  }, [closePopup, onUnitUpdate])

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full" />
  )
}
