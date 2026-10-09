import { afterEach, describe, expect, it, vi } from 'vitest'
import { ALL_PERMS, PAGE_SECTIONS, USERS_PERM, canAny, getAccess, normalizePerms, pageViewPerms } from './auth.js'
import { ALL_PERMS as UI_ALL_PERMS, PAGES } from '../../src/dashboard/permissions.js'

describe('permissions definition', () => {
  it('server PAGE_SECTIONS matches UI PAGES (pages, sections, actions)', () => {
    const ui = Object.fromEntries(PAGES.map((p) => [p.id, Object.fromEntries(p.sections.map((s) => [s.id, s.actions]))]))
    expect(PAGE_SECTIONS).toEqual(ui)
    expect(ALL_PERMS).toEqual(UI_ALL_PERMS)
  })
})

describe('normalizePerms', () => {
  it('drops unknown permissions and non-arrays', () => {
    expect(normalizePerms(['items-all:view', 'nope:view', 'items-all:fly'])).toEqual(['items-all:view'])
    expect(normalizePerms(null)).toEqual([])
  })
  it('edit/delete imply view of the same section only', () => {
    expect(normalizePerms(['items-all:delete'])).toEqual(['items-all:view', 'items-all:delete'])
    expect(normalizePerms(['usage-settings:edit'])).toEqual(['usage-settings:view', 'usage-settings:edit'])
  })
  it('does not grant users:manage', () => {
    expect(normalizePerms(['users:manage'])).toEqual([])
  })
})

describe('getAccess / canAny', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
  const stubTable = (rows) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => rows })))
  const useEnv = (owners = '') => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k')
    vi.stubEnv('DASHBOARD_ALLOWED_EMAILS', owners)
  }

  it('env owner gets everything including users:manage (case-insensitive, no table lookup)', async () => {
    useEnv('Boss@x.com')
    stubTable([])
    const a = await getAccess({ email: 'BOSS@x.com' })
    expect(a.role).toBe('owner')
    expect(a.perms).toContain(USERS_PERM)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('member only gets ticked permissions (normalized)', async () => {
    useEnv()
    stubTable([{ role: 'member', perms: ['items-all:delete', 'bogus:view'] }])
    const a = await getAccess({ email: 'm@x.com' })
    expect(a).toEqual({ role: 'member', perms: ['items-all:view', 'items-all:delete'] })
    expect(await canAny({ email: 'm@x.com' }, ['items-all:delete'])).toBe(true)
    expect(await canAny({ email: 'm@x.com' }, ['items-pending:edit', ...pageViewPerms('monitor')])).toBe(false)
  })
  it('unknown email, unknown role, or missing email → no access', async () => {
    useEnv()
    stubTable([])
    expect(await getAccess({ email: 'n@x.com' })).toEqual({ role: null, perms: [] })
    stubTable([{ role: 'admin', perms: ALL_PERMS }])
    expect(await getAccess({ email: 'n@x.com' })).toEqual({ role: null, perms: [] })
    expect(await getAccess(null)).toEqual({ role: null, perms: [] })
  })
  it('expired membership → no access; future expiry and env owners unaffected', async () => {
    useEnv('boss@x.com')
    stubTable([{ role: 'member', perms: ['items-all:view'], expires_at: new Date(Date.now() - 1000).toISOString() }])
    expect(await getAccess({ email: 'm@x.com' })).toEqual({ role: null, perms: [] })
    stubTable([{ role: 'member', perms: ['items-all:view'], expires_at: new Date(Date.now() + 86400000).toISOString() }])
    expect((await getAccess({ email: 'm@x.com' })).role).toBe('member')
    stubTable([{ role: 'member', perms: ['items-all:view'], expires_at: null }])
    expect((await getAccess({ email: 'm@x.com' })).role).toBe('member')
    stubTable([{ role: 'owner', perms: [], expires_at: new Date(Date.now() - 1000).toISOString() }])
    expect(await getAccess({ email: 'o@x.com' })).toEqual({ role: null, perms: [] })
    expect((await getAccess({ email: 'boss@x.com' })).role).toBe('owner')
  })
  it('table read failure → fail closed', async () => {
    useEnv()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    expect(await getAccess({ email: 'm@x.com' })).toEqual({ role: null, perms: [] })
  })
})
