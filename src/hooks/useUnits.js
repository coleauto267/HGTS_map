import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useUnits() {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadUnits = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // GeoJSON is always the source of truth for addresses + coordinates
      const res = await fetch('/HGTS_Addresses.geojson')
      const geojson = await res.json()

      // Load all Supabase rows for status + notes (no pagination needed — 732 rows)
      const { data: dbRows, error: fetchErr } = await supabase
        .from('units')
        .select('*')
        .limit(5000)
      if (fetchErr) throw fetchErr

      // Index Supabase rows by full_address — the unique identifier for every unit
      const dbByAddress = {}
      for (const row of (dbRows || [])) {
        if (row.full_address) dbByAddress[row.full_address] = row
      }

      // Merge: GeoJSON drives coords/identity, Supabase drives status/notes/id
      const merged = geojson.features.map((f) => {
        const parcelId = f.properties.ParcelID || ''
        const fullAddr = f.properties.Full_Addr || ''
        const dbRow = dbByAddress[fullAddr] || null

        return {
          id: dbRow?.id || null,
          full_address: fullAddr,
          street_name: f.properties.St_Name || '',
          parcel_id: parcelId,
          post_code: f.properties.Post_Code || '18974',
          lat: f.properties.Lat ?? f.geometry?.coordinates?.[1] ?? null,
          lon: f.properties.Long ?? f.geometry?.coordinates?.[0] ?? null,
          status: dbRow?.status || 'none',
          notes: dbRow?.notes || '',
          is_urgent: dbRow?.is_urgent || false,
        }
      })

      setUnits(merged)
    } catch (err) {
      console.error('Failed to load units:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  // Takes the full unit object (not just id) so we can insert if it hasn't
  // been saved to Supabase yet (id === null).
  const updateUnit = useCallback(async (unit, updates) => {
    const now = new Date().toISOString()
    let dbRow

    if (unit.id) {
      const { data, error: err } = await supabase
        .from('units')
        .update({ ...updates, updated_at: now })
        .eq('id', unit.id)
        .select()
        .single()
      if (err) throw err
      dbRow = data
    } else {
      // First time this unit is saved — insert into Supabase
      const { data, error: err } = await supabase
        .from('units')
        .insert({
          full_address: unit.full_address,
          street_name: unit.street_name,
          parcel_id: unit.parcel_id,
          lat: unit.lat,
          lon: unit.lon,
          ...updates,
          updated_at: now,
        })
        .select()
        .single()
      if (err) throw err
      dbRow = data
    }

    const updatedUnit = {
      ...unit,
      id: dbRow.id,
      status: dbRow.status,
      notes: dbRow.notes,
      is_urgent: dbRow.is_urgent,
    }

    setUnits((prev) => prev.map((u) => {
      if (unit.id && u.id === unit.id) return updatedUnit
      if (!unit.id && u.full_address === unit.full_address) return updatedUnit
      return u
    }))

    return updatedUnit
  }, [])

  return { units, loading, error, updateUnit }
}
