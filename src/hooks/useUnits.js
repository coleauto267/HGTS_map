import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useUnits() {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const seedFromGeoJSON = useCallback(async () => {
    const res = await fetch('/HGTS_Addresses.geojson')
    const geojson = await res.json()

    const rows = geojson.features.map((f) => ({
      full_address: f.properties.Full_Addr || '',
      street_name: f.properties.St_Name || '',
      parcel_id: f.properties.ParcelID || '',
      lat: f.properties.Lat ?? f.geometry?.coordinates?.[1] ?? null,
      lon: f.properties.Long ?? f.geometry?.coordinates?.[0] ?? null,
      status: 'none',
      notes: '',
    }))

    // Insert in batches of 200 to stay under payload limits
    const batchSize = 200
    const inserted = []
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const { data, error } = await supabase.from('units').insert(batch).select()
      if (error) throw error
      inserted.push(...data)
    }
    return inserted
  }, [])

  const loadUnits = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { count, error: countErr } = await supabase
        .from('units')
        .select('*', { count: 'exact', head: true })
      if (countErr) throw countErr

      let data
      if (count === 0) {
        data = await seedFromGeoJSON()
      } else {
        const { data: fetched, error: fetchErr } = await supabase
          .from('units')
          .select('*')
          .order('full_address')
        if (fetchErr) throw fetchErr
        data = fetched
      }
      setUnits(data)
    } catch (err) {
      console.error('Failed to load units:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [seedFromGeoJSON])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  const updateUnit = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('units')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setUnits((prev) => prev.map((u) => (u.id === id ? data : u)))
    return data
  }, [])

  return { units, loading, error, updateUnit }
}
