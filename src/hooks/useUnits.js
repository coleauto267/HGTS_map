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

      // Load unit-level rows (identity/contact + manual status) and every
      // project (task) row — no pagination needed at this scale
      const [{ data: dbRows, error: unitsErr }, { data: projectRows, error: projectsErr }] = await Promise.all([
        supabase.from('units').select('*').limit(5000),
        supabase.from('projects').select('*').limit(20000),
      ])
      if (unitsErr) throw unitsErr
      if (projectsErr) throw projectsErr

      // Index Supabase unit rows by full_address — the unique identifier for every unit
      const dbByAddress = {}
      for (const row of (dbRows || [])) {
        if (row.full_address) dbByAddress[row.full_address] = row
      }

      // Group projects by the unit they belong to
      const projectsByUnitId = {}
      for (const p of (projectRows || [])) {
        if (!projectsByUnitId[p.unit_id]) projectsByUnitId[p.unit_id] = []
        projectsByUnitId[p.unit_id].push(p)
      }

      // Merge: GeoJSON drives coords/identity, Supabase drives status/contact/id,
      // and each unit's projects (tasks) come along keyed by unit_id
      const merged = geojson.features.map((f) => {
        const fullAddr = f.properties.Full_Addr || ''
        const dbRow = dbByAddress[fullAddr] || null

        return {
          id: dbRow?.id || null,
          full_address: fullAddr,
          street_name: f.properties.St_Name || '',
          post_code: f.properties.Post_Code || '18974',
          lat: f.properties.Lat ?? f.geometry?.coordinates?.[1] ?? null,
          lon: f.properties.Long ?? f.geometry?.coordinates?.[0] ?? null,
          status: dbRow?.status || 'none',
          occupant: dbRow?.occupant || '',
          phone: dbRow?.phone || '',
          email: dbRow?.email || '',
          universal_key: dbRow?.universal_key || false,
          projects: dbRow?.id ? (projectsByUnitId[dbRow.id] || []) : [],
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

  // Saves unit-level fields (status, occupant, phone, email, universal_key)
  // to `units`. Takes the full unit object (not just id) so we can insert if
  // it hasn't been saved to Supabase yet (id === null).
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
      occupant: dbRow.occupant,
      phone: dbRow.phone,
      email: dbRow.email,
      universal_key: dbRow.universal_key,
    }

    setUnits((prev) => prev.map((u) => {
      if (unit.id && u.id === unit.id) return updatedUnit
      if (!unit.id && u.full_address === unit.full_address) return updatedUnit
      return u
    }))

    return updatedUnit
  }, [])

  // Makes sure `unit` has a row in `units` (bare insert if it doesn't have
  // one yet), returning its id. Needed before a project can reference it.
  const ensureUnitRow = useCallback(async (unit) => {
    if (unit.id) return unit.id
    const { data, error: err } = await supabase
      .from('units')
      .insert({
        full_address: unit.full_address,
        street_name: unit.street_name,
        lat: unit.lat,
        lon: unit.lon,
      })
      .select()
      .single()
    if (err) throw err
    return data.id
  }, [])

  // Adds a new task (project row) for a unit. Creates the unit's row first
  // if this is the very first thing ever saved for it.
  const addProject = useCallback(async (unit, projectData) => {
    const unitId = await ensureUnitRow(unit)
    const { data, error: err } = await supabase
      .from('projects')
      .insert({ unit_id: unitId, ...projectData })
      .select()
      .single()
    if (err) throw err

    const updatedUnit = { ...unit, id: unitId, projects: [...(unit.projects || []), data] }
    setUnits((prev) => prev.map((u) => (u.full_address === unit.full_address ? updatedUnit : u)))
    return updatedUnit
  }, [ensureUnitRow])

  // Updates an existing task (project row) — priority/notes edits, or
  // flipping status between 'open' and 'done'.
  const updateProject = useCallback(async (unit, project, updates) => {
    const now = new Date().toISOString()
    const { data, error: err } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: now })
      .eq('id', project.id)
      .select()
      .single()
    if (err) throw err

    const updatedUnit = {
      ...unit,
      projects: unit.projects.map((p) => (p.id === data.id ? data : p)),
    }
    setUnits((prev) => prev.map((u) => (u.full_address === unit.full_address ? updatedUnit : u)))
    return updatedUnit
  }, [])

  return { units, loading, error, updateUnit, addProject, updateProject }
}
