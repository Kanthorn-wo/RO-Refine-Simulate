import { describe, expect, it } from 'vitest'
import { PAGE_SECTIONS } from './auth.js'
import { SECTION_SPECS, filterForUser, redactBySections } from './sectionAccess.js'

const access = (...sections) => ({ perms: sections.map((s) => `${s}:view`) })
const allSections = (page) => Object.keys(PAGE_SECTIONS[page])

const gaSample = {
  range: { startDate: '2026-01-01', endDate: 'today' },
  totals: { activeUsers: 5 }, timeseries: [{ d: 1 }], hourly: [{ h: 1 }], topPages: [{ path: '/' }],
  devices: [{ category: 'mobile' }], countries: [{ country: 'TH' }], cities: [{ city: 'BKK' }],
  channels: [{ channel: 'Direct' }], audience: { newUsers: 1 }, events: [{ name: 'x' }],
}

describe('filterForUser', () => {
  it('full access to the page returns data unchanged', () => {
    expect(filterForUser('analytics', gaSample, access(...allSections('analytics')))).toEqual(gaSample)
  })
  it('only an-geo: other sections become empty (arrays [], objects {}), meta kept', () => {
    const out = filterForUser('analytics', gaSample, access('an-geo'))
    expect(out.countries).toEqual(gaSample.countries)
    expect(out.cities).toEqual(gaSample.cities)
    expect(out.range).toEqual(gaSample.range)
    expect(out.totals).toEqual({})
    expect(out.timeseries).toEqual([])
    expect(out.audience).toEqual({})
    expect(out.topPages).toEqual([])
  })
  it('a key shared by two sections is kept when either is viewable', () => {
    expect(filterForUser('analytics', gaSample, access('an-trend')).timeseries).toEqual(gaSample.timeseries)
    expect(filterForUser('analytics', gaSample, access('an-kpi')).timeseries).toEqual(gaSample.timeseries)
    expect(filterForUser('analytics', gaSample, access('an-kpi')).hourly).toEqual([])
  })
  it('nested overview.visitors is filtered per sub-key', () => {
    const data = {
      since: { visitors: 'd' },
      visitors: { total: 10, returning: 4, days_1: 6, consent_accepted: 3, active_since_log: 9 },
      adoption: { refined: 2 }, max_level: { l0_4: 1 }, outcome: { all: { success: 1 } }, breakdown: { success: 1 }, totals: { refine: 5 },
    }
    const out = filterForUser('overview', data, access('ov-return'))
    expect(out.visitors).toEqual({ total: 10, returning: 4, days_1: 6 })
    expect(out.adoption).toEqual({})
    expect(out.max_level).toEqual({})
    expect(out.totals).toEqual({})
    expect(out.since).toEqual(data.since)
  })
  it('unknown key is withheld unless the user can view every section of the page', () => {
    const data = { ...gaSample, brandNewField: [1, 2, 3] }
    expect(filterForUser('analytics', data, access('an-geo')).brandNewField).toEqual([])
    expect(filterForUser('analytics', data, access(...allSections('analytics'))).brandNewField).toEqual([1, 2, 3])
  })
  it('refine: only refine-* sections count as the page; user with no section gets nothing', () => {
    const data = { leaderboard: [{ a: 1 }], breakdown: { r: 1 }, log: [{ id: 1 }], total: 7, page: 1, limit: 50, levelResult: [1], stoneUsage: [1], stoneUsageTotal: 3 }
    const out = filterForUser('refine', data, access('refine-log'))
    expect(out.log).toEqual(data.log)
    expect(out.total).toBe(7)
    expect(out.leaderboard).toEqual([])
    expect(out.breakdown).toEqual({})
    expect(out.stoneUsageTotal).toBeNull()
    const none = filterForUser('refine', data, { perms: [] })
    expect(none.log).toEqual([])
    expect(none.page).toBe(1)
  })
})

describe('redactBySections', () => {
  it('handles null/undefined data', () => {
    expect(redactBySections(undefined, {}, () => true, [])).toEqual({})
  })
})

describe('spec coverage (guards against typos and forgotten sections)', () => {
  const known = new Set(Object.values(PAGE_SECTIONS).flatMap((s) => Object.keys(s)))
  const ruleSections = (rule) => (Array.isArray(rule) ? rule : rule === '*' ? [] : Object.values(rule).flatMap(ruleSections))
  const used = (endpoint) => new Set(Object.values(SECTION_SPECS[endpoint]).flatMap(ruleSections))

  it('every section id in a spec exists in PAGE_SECTIONS', () => {
    for (const endpoint of Object.keys(SECTION_SPECS)) {
      for (const id of used(endpoint)) expect(known.has(id), `${endpoint}: unknown section ${id}`).toBe(true)
    }
  })
  it('every viewable section of each filtered page appears in its spec (otherwise that section would always be empty)', () => {
    const pages = { analytics: allSections('analytics'), monitor: allSections('monitor'), overview: allSections('overview'), refine: allSections('usage').filter((id) => id.startsWith('refine-')) }
    for (const [endpoint, sections] of Object.entries(pages)) {
      for (const id of sections) expect(used(endpoint).has(id), `${endpoint}: section ${id} has no data in spec`).toBe(true)
    }
  })
})
