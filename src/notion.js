// notion.js v11 — + паливо, показники світла, доступ до палива

const DB = {
  shifts:       import.meta.env.VITE_DB_SHIFTS,
  staff:        import.meta.env.VITE_DB_STAFF,
  advances:     import.meta.env.VITE_DB_ADVANCES,
  bonuses:      import.meta.env.VITE_DB_BONUSES,
  fixedStaff:   import.meta.env.VITE_DB_FIXED_STAFF,
  debts:        import.meta.env.VITE_DB_DEBTS,
  debtPayments: import.meta.env.VITE_DB_DEBT_PAYMENTS,
  settings:     import.meta.env.VITE_DB_SETTINGS,
  logs:         import.meta.env.VITE_DB_LOGS,
  firms:        import.meta.env.VITE_DB_FIRMS,
  materials:    import.meta.env.VITE_DB_MATERIALS,
  sizes:        import.meta.env.VITE_DB_SIZES,
  shipments:    import.meta.env.VITE_DB_SHIPMENTS,
  suppliers:    import.meta.env.VITE_DB_SUPPLIERS,
  intake:       import.meta.env.VITE_DB_INTAKE,
  fuel:         import.meta.env.VITE_DB_FUEL,
  electricity:  import.meta.env.VITE_DB_ELECTRICITY,
}

async function nr(path, method = 'POST', body = null) {
  const r = await fetch('/api/notion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, method, body }),
  })
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Помилка') }
  return r.json()
}

// ── ПАГІНАЦІЯ — отримуємо ВСІ записи без обмежень ─────────
export async function queryDB(id, filter, sorts) {
  const allResults = []
  let cursor = undefined
  while (true) {
    const body = {
      page_size: 100,
      ...(filter ? { filter } : {}),
      ...(sorts  ? { sorts  } : {}),
      ...(cursor ? { start_cursor: cursor } : {}),
    }
    const data = await nr(`/databases/${id}/query`, 'POST', body)
    allResults.push(...(data.results || []))
    if (data.has_more && data.next_cursor) cursor = data.next_cursor
    else break
  }
  return { results: allResults }
}

export const createPage  = (id, props) => nr('/pages', 'POST', { parent: { database_id: id }, properties: props })
export const updatePage  = (id, props) => nr(`/pages/${id}`, 'PATCH', { properties: props })
export const archivePage = (id)        => nr(`/pages/${id}`, 'PATCH', { archived: true })

const p = {
  text: v => v?.rich_text?.[0]?.plain_text || v?.title?.[0]?.plain_text || '',
  num:  v => v?.number ?? 0,
  numN: v => (v?.number ?? null),  // null якщо порожнє (для індивідуальних налаштувань)
  date: v => v?.date?.start || '',
  bool: v => v?.checkbox ?? false,
}

export function monthRange(year, month) {
  const y = year  ?? new Date().getFullYear()
  const m = month ?? new Date().getMonth()
  return {
    start: `${y}-${String(m+1).padStart(2,'0')}-01`,
    end:   new Date(y, m+1, 0).toISOString().slice(0,10),
  }
}

function dateFilter(field, year, month) {
  const { start, end } = monthRange(year, month)
  return { and: [
    { property: field, date: { on_or_after: start } },
    { property: field, date: { on_or_before: end } },
  ]}
}

export const DEFAULT_CFG = {
  minDaysForBonus: 19, bonusPerLongDay: 100, bonusSaturday: 300,
  premiumDays: 21, premiumAmount: 4000, longDayHours: 10, longDaysNeeded: 10,
  lunchBreak: 1, electricityTariff: 0,
}

export async function fetchSettings() {
  try {
    const r = await queryDB(DB.settings)
    if (!r.results?.length) return DEFAULT_CFG
    const q = r.results[0].properties
    return {
      minDaysForBonus:    p.num(q['Мін. днів для бонусів'])  || DEFAULT_CFG.minDaysForBonus,
      bonusPerLongDay:    p.num(q['Бонус за день 10+ год'])  || DEFAULT_CFG.bonusPerLongDay,
      bonusSaturday:      p.num(q['Бонус за суботу'])        || DEFAULT_CFG.bonusSaturday,
      premiumDays:        p.num(q['Днів для премії'])        || DEFAULT_CFG.premiumDays,
      premiumAmount:      p.num(q['Сума премії'])            || DEFAULT_CFG.premiumAmount,
      longDayHours:       p.num(q['Годин для довгого дня'])  || DEFAULT_CFG.longDayHours,
      longDaysNeeded:     p.num(q['Потрібно довгих днів'])   || DEFAULT_CFG.longDaysNeeded,
      lunchBreak:         p.num(q['Обід (год)'])             ?? DEFAULT_CFG.lunchBreak,
      electricityTariff:  p.num(q['Тариф електрики'])       ?? 0,
      pageId: r.results[0].id,
    }
  } catch { return DEFAULT_CFG }
}

export async function saveSettings(pageId, cfg) {
  const props = {
    'Мін. днів для бонусів': { number: cfg.minDaysForBonus },
    'Бонус за день 10+ год': { number: cfg.bonusPerLongDay },
    'Бонус за суботу':       { number: cfg.bonusSaturday },
    'Днів для премії':       { number: cfg.premiumDays },
    'Сума премії':           { number: cfg.premiumAmount },
    'Годин для довгого дня': { number: cfg.longDayHours },
    'Потрібно довгих днів':  { number: cfg.longDaysNeeded },
    'Обід (год)':            { number: cfg.lunchBreak },
    'Тариф електрики':       { number: cfg.electricityTariff ?? 0 },
  }
  if (pageId) return updatePage(pageId, props)
  return createPage(DB.settings, { 'Назва':{ title:[{ text:{ content:'Налаштування' } }] }, ...props })
}

export async function fetchAllData(year, month) {
  const df = f => dateFilter(f, year, month)
  const [shifts, staff, advances, bonuses, fixedStaff, debts, debtPayments, settings] =
    await Promise.all([
      queryDB(DB.shifts,       df('Дата')),
      queryDB(DB.staff),
      queryDB(DB.advances,     df('Дата')),
      queryDB(DB.bonuses,      df('Дата')),
      queryDB(DB.fixedStaff),
      queryDB(DB.debts),
      queryDB(DB.debtPayments, df('Дата')),
      fetchSettings(),
    ])
  return {
    shifts:       shifts.results.map(parseShift),
    staff:        staff.results.map(parseStaff),
    advances:     advances.results.map(parseAdvance),
    bonuses:      bonuses.results.map(parseBonus),
    fixedStaff:   fixedStaff.results.map(parseFixed),
    debts:        debts.results.map(parseDebt),
    debtPayments: debtPayments.results.map(parseDP),
    cfg:          settings,
  }
}

export async function fetchMonthlyStats(tgId, monthsCount = 6) {
  const now = new Date()
  const results = []
  for (let i = monthsCount-1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i)
    const y = d.getFullYear(), m = d.getMonth()
    const { start, end } = monthRange(y, m)
    const filter = { and: [
      { property:'ID', number:{ equals:tgId } },
      { property:'Дата', date:{ on_or_after:start } },
      { property:'Дата', date:{ on_or_before:end } },
    ]}
    const r = await queryDB(DB.shifts, filter)
    const shifts = r.results.map(parseShift)
    const totalHours = shifts.reduce((s,sh)=>s+sh.hours,0)
    const totalPacks = shifts.reduce((s,sh)=>s+sh.packs,0)
    const rateH = shifts[0]?.rateHour||0
    const rateP = shifts[0]?.ratePack||0
    results.push({
      month: ['Січ','Лют','Бер','Квіт','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'][m],
      year: y, monthIdx: m,
      earned: totalHours*rateH + totalPacks*rateP,
      hours: totalHours, packs: totalPacks,
    })
  }
  return results
}

function parseShift(r) {
  const q = r.properties
  return { id:r.id, tgId:p.num(q['ID']), name:p.text(q['ПІБ']), date:p.date(q['Дата']),
    hours:p.num(q['Години']), packs:p.num(q['Кількість збитих пачок']),
    rateHour:p.num(q['Ставка в год.']), ratePack:p.num(q['Ставка за збиту пачку']) }
}
function parseStaff(r) {
  const q = r.properties
  return { id:r.id, tgId:p.num(q['ID']), name:p.text(q['ПІБ']),
    rateHour:p.num(q['Ставка в годину']), ratePack:p.num(q['Ставка за пачку']),
    bonusOff:p.bool(q['Бонуси вимкнено']), premiumOff:p.bool(q['Премії вимкнено']),
    fuelAccess:p.bool(q['Доступ до палива']),
    ind: {
      minDaysForBonus: p.numN(q['Мін днів бонус']),
      bonusPerLongDay: p.numN(q['Бонус за довгий день']),
      bonusSaturday:   p.numN(q['Бонус субота']),
      premiumDays:     p.numN(q['Днів премія']),
      premiumAmount:   p.numN(q['Сума премії']),
      longDayHours:    p.numN(q['Годин довгий день']),
      longDaysNeeded:  p.numN(q['Потрібно довгих днів']),
    },
  }
}
function parseAdvance(r) {
  const q = r.properties
  return { id:r.id, tgId:p.num(q['ID']), name:p.text(q['ПІБ']), date:p.date(q['Дата']), amount:p.num(q['Сума авансу']) }
}
function parseBonus(r) {
  const q = r.properties
  return { id:r.id, tgId:p.num(q['ID']), name:p.text(q['ПІБ']), date:p.date(q['Дата']),
    amount:p.num(q['Сума премії']), reason:p.text(q['Причина']) }
}
function parseFixed(r) {
  const q = r.properties
  return { id:r.id, tgId:p.num(q['ID']), name:p.text(q['ПІБ']),
    salary:p.num(q['Фіксована зарплата']), role:p.text(q['Посада']) }
}
function parseDebt(r) {
  const q = r.properties
  return { id:r.id, tgId:p.num(q['ID']), name:p.text(q['ПІБ']),
    total:p.num(q['Сума боргу']), remaining:p.num(q['Залишок боргу']) }
}
function parseDP(r) {
  const q = r.properties
  return { id:r.id, tgId:p.num(q['ID']), name:p.text(q['ПІБ']), date:p.date(q['Дата']), amount:p.num(q['Сума виплати']) }
}

export async function saveShift({ tgId, name, rateHour, ratePack, date, hours, packs, lunchBreak=1 }) {
  const actualHours = Math.max(0, hours - lunchBreak)
  return createPage(DB.shifts, {
    'ПІБ':                       { title:[{ text:{ content:name } }] },
    'ID':                        { number:tgId },
    'Дата':                      { date:{ start:date } },
    'Години':                    { number:actualHours },
    'Кількість збитих пачок':    { number:packs },
    'Ставка в год.':             { number:rateHour },
    'Ставка за збиту пачку':     { number:ratePack },
    'Виробіток з годин':         { number:actualHours*rateHour },
    'Виробіток зі збитих пачок': { number:packs*ratePack },
  })
}

export async function updateShift(pageId, { hours, packs, rateHour, ratePack, lunchBreak=0 }) {
  const actualHours = Math.max(0, hours - lunchBreak)
  return updatePage(pageId, {
    'Години':                    { number:actualHours },
    'Кількість збитих пачок':    { number:packs },
    'Виробіток з годин':         { number:actualHours*rateHour },
    'Виробіток зі збитих пачок': { number:packs*ratePack },
  })
}

// Видалення зміни (архівує всі записи за день)
export async function deleteShift(pageIds) {
  for (const id of pageIds) { await archivePage(id) }
}

export async function saveBonusRecord({ tgId, name, date, amount, reason }) {
  return createPage(DB.bonuses, {
    'ПІБ':         { title:[{ text:{ content:name } }] },
    'ID':          { number:tgId },
    'Дата':        { date:{ start:date } },
    'Сума премії': { number:amount },
    'Причина':     { rich_text:[{ text:{ content:reason||'' } }] },
  })
}

export async function saveAdvance({ tgId, name, date, amount }) {
  return createPage(DB.advances, {
    'ПІБ':         { title:[{ text:{ content:name } }] },
    'ID':          { number:tgId },
    'Дата':        { date:{ start:date } },
    'Сума авансу': { number:amount },
  })
}

export async function saveDebtPayment({ tgId, name, date, amount, debtPageId, currentRemaining }) {
  await createPage(DB.debtPayments, {
    'ПІБ':          { title:[{ text:{ content:name } }] },
    'ID':           { number:tgId },
    'Дата':         { date:{ start:date } },
    'Сума виплати': { number:amount },
  })
  const newRemaining = Math.max(0, currentRemaining - amount)
  await updatePage(debtPageId, { 'Залишок боргу':{ number:newRemaining } })
  return newRemaining
}

export async function addDebt({ tgId, name, amount }) {
  const existing = await queryDB(DB.debts, { property:'ID', number:{ equals:tgId } })
  if (existing.results?.length) {
    const old = existing.results[0]
    return updatePage(old.id, {
      'Сума боргу':    { number:(old.properties['Сума боргу']?.number||0)+amount },
      'Залишок боргу': { number:(old.properties['Залишок боргу']?.number||0)+amount },
    })
  }
  return createPage(DB.debts, {
    'ПІБ':           { title:[{ text:{ content:name } }] },
    'ID':            { number:tgId },
    'Сума боргу':    { number:amount },
    'Залишок боргу': { number:amount },
  })
}

export async function addStaff({ tgId, name, rateHour, ratePack }) {
  return createPage(DB.staff, {
    'ПІБ':             { title:[{ text:{ content:name } }] },
    'ID':              { number:tgId },
    'Ставка в годину': { number:rateHour },
    'Ставка за пачку': { number:ratePack },
  })
}

export async function addFixedStaff({ tgId, name, salary, role }) {
  return createPage(DB.fixedStaff, {
    'ПІБ':                { title:[{ text:{ content:name } }] },
    'ID':                 { number:tgId },
    'Фіксована зарплата': { number:salary },
    'Посада':             { rich_text:[{ text:{ content:role||'' } }] },
  })
}

export async function updateStaffRates(pageId, { rateHour, ratePack }) {
  const props = {}
  if (rateHour !== undefined) props['Ставка в годину'] = { number:Number(rateHour) }
  if (ratePack !== undefined) props['Ставка за пачку'] = { number:Number(ratePack) }
  return updatePage(pageId, props)
}

export async function updateFixedSalary(pageId, salary) {
  return updatePage(pageId, { 'Фіксована зарплата':{ number:Number(salary) } })
}

export async function updateStaffInfo(pageId, { name, tgId }) {
  const props = {}
  if (name)  props['ПІБ'] = { title:[{ text:{ content:name } }] }
  if (tgId)  props['ID']  = { number:Number(tgId) }
  return updatePage(pageId, props)
}

// Тумблери бонусів / премій + індивідуальні налаштування + доступ до палива
export async function updateStaffToggles(pageId, { bonusOff, premiumOff, ind, fuelAccess }) {
  const props = {}
  if (bonusOff   !== undefined) props['Бонуси вимкнено'] = { checkbox: bonusOff }
  if (premiumOff !== undefined) props['Премії вимкнено'] = { checkbox: premiumOff }
  if (fuelAccess !== undefined) props['Доступ до палива'] = { checkbox: fuelAccess }
  if (ind) {
    // null/'' → очистити поле (буде загальне), число → індивідуальне
    const setNum = (key, val) => {
      if (val === '' || val === null || val === undefined) props[key] = { number: null }
      else props[key] = { number: Number(val) }
    }
    setNum('Мін днів бонус',         ind.minDaysForBonus)
    setNum('Бонус за довгий день',   ind.bonusPerLongDay)
    setNum('Бонус субота',           ind.bonusSaturday)
    setNum('Днів премія',            ind.premiumDays)
    setNum('Сума премії',            ind.premiumAmount)
    setNum('Годин довгий день',      ind.longDayHours)
    setNum('Потрібно довгих днів',   ind.longDaysNeeded)
  }
  return updatePage(pageId, props)
}

export async function deleteStaff(pageId) { return archivePage(pageId) }

export async function writeLog({ tgId, name, action, details }) {
  try {
    await createPage(DB.logs, {
      'Дія':    { title:[{ text:{ content:action } }] },
      'ID':     { number:tgId },
      'ПІБ':    { rich_text:[{ text:{ content:name } }] },
      'Деталі': { rich_text:[{ text:{ content:details||'' } }] },
      'Дата':   { date:{ start:new Date().toISOString() } },
    })
  } catch(e) { console.warn('Log:', e.message) }
}

export async function checkAccess(tgId) {
  if (!tgId) return { allowed:false }
  const [s, f] = await Promise.all([
    queryDB(DB.staff,      { property:'ID', number:{ equals:tgId } }),
    queryDB(DB.fixedStaff, { property:'ID', number:{ equals:tgId } }),
  ])
  const sp = s.results?.[0], fp = f.results?.[0]
  if (!sp && !fp) return { allowed:false }
  const page = sp || fp
  return { allowed:true, type:fp?'fixed':'shift', name:p.text(page.properties['ПІБ']), tgId, pageId:page.id }
}

// ════════ ВІДПРАВКИ ════════════════════════════════════════
export async function fetchShipmentRefs() {
  const [firms, materials, sizes] = await Promise.all([
    queryDB(DB.firms),
    queryDB(DB.materials),
    queryDB(DB.sizes),
  ])
  const sortByName = (a,b)=>a.name.localeCompare(b.name,'uk')
  return {
    firms:     firms.results.map(r=>({ id:r.id, name:p.text(r.properties['Назва']) })).filter(x=>x.name).sort(sortByName),
    materials: materials.results.map(r=>({ id:r.id, name:p.text(r.properties['Назва']) })).filter(x=>x.name).sort(sortByName),
    sizes:     sizes.results.map(r=>({ id:r.id, name:p.text(r.properties['Назва']) })).filter(x=>x.name).sort(sortByName),
  }
}

export async function addFirm(name) {
  return createPage(DB.firms, { 'Назва':{ title:[{ text:{ content:name } }] } })
}
export async function addMaterial(name) {
  return createPage(DB.materials, { 'Назва':{ title:[{ text:{ content:name } }] } })
}
export async function addSize(name) {
  return createPage(DB.sizes, { 'Назва':{ title:[{ text:{ content:name } }] } })
}
export async function deleteRef(pageId) { return archivePage(pageId) }

// Кожен рядок у Notion = одна позиція. Позиції однієї відправки
// поєднані спільним точним часом (Дата з часом) + фірмою.
export async function fetchShipmentRows(year, month) {
  const r = await queryDB(DB.shipments, dateFilter('Дата', year, month),
    [{ property:'Дата', direction:'descending' }])
  return r.results.map(rr => {
    const q = rr.properties
    return {
      id:       rr.id,
      firm:     p.text(q['Фірма']),
      material: p.text(q['Вид']),
      size:     p.text(q['Розмір']),
      qty:      p.num(q['Кількість']),
      date:     p.date(q['Дата']),
    }
  })
}

// Згрупувати рядки у відправки: одна відправка = фірма + однаковий date
export function groupShipments(rows) {
  const map = {}
  rows.forEach(row => {
    const key = `${row.firm}||${row.date}`
    if (!map[key]) map[key] = {
      key, firm:row.firm, date:row.date,
      dateShort:(row.date||'').slice(0,10),
      positions:[], rowIds:[],
    }
    map[key].positions.push({ id:row.id, material:row.material, size:row.size, qty:row.qty })
    map[key].rowIds.push(row.id)
  })
  return Object.values(map).sort((a,b)=>(b.date||'').localeCompare(a.date||''))
}

// Зберегти відправку з кількома позиціями (усі рядки — однаковий timestamp)
export async function saveShipmentGroup({ firm, dateShort, positions }) {
  const now = new Date()
  const stamp = `${dateShort}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}.${String(now.getMilliseconds()).padStart(3,'0')}`
  for (const pos of positions) {
    await createPage(DB.shipments, {
      'Фірма':     { title:[{ text:{ content:firm } }] },
      'Вид':       { rich_text:[{ text:{ content:pos.material||'' } }] },
      'Розмір':    { rich_text:[{ text:{ content:pos.size||'' } }] },
      'Кількість': { number:Number(pos.qty)||0 },
      'Дата':      { date:{ start:stamp } },
    })
  }
}

// Оновити відправку: видаляємо старі рядки, створюємо нові з тим же timestamp
export async function updateShipmentGroup({ oldRowIds, firm, date, positions }) {
  for (const id of oldRowIds) { await archivePage(id) }
  for (const pos of positions) {
    await createPage(DB.shipments, {
      'Фірма':     { title:[{ text:{ content:firm } }] },
      'Вид':       { rich_text:[{ text:{ content:pos.material||'' } }] },
      'Розмір':    { rich_text:[{ text:{ content:pos.size||'' } }] },
      'Кількість': { number:Number(pos.qty)||0 },
      'Дата':      { date:{ start:date } },
    })
  }
}

export async function deleteShipmentGroup(rowIds) {
  for (const id of rowIds) { await archivePage(id) }
}

// Статистика по матеріалах: { material: { total, sizes:{size:qty}, hasSizes } }
export function statsByMaterial(rows) {
  const stats = {}
  rows.forEach(s => {
    const m = s.material || 'Без виду'
    if (!stats[m]) stats[m] = { total:0, sizes:{}, hasSizes:false }
    stats[m].total += s.qty
    if (s.size && s.size.trim()) {
      stats[m].sizes[s.size] = (stats[m].sizes[s.size]||0) + s.qty
      stats[m].hasSizes = true
    }
  })
  return stats
}

// Статистика по фірмах: { firm: { total, materials:{ material:{total,sizes,hasSizes} } } }
export function statsByFirm(rows) {
  const stats = {}
  rows.forEach(s => {
    const f = s.firm || 'Без фірми'
    const m = s.material || 'Без виду'
    if (!stats[f]) stats[f] = { total:0, materials:{} }
    if (!stats[f].materials[m]) stats[f].materials[m] = { total:0, sizes:{}, hasSizes:false }
    stats[f].total += s.qty
    stats[f].materials[m].total += s.qty
    if (s.size && s.size.trim()) {
      stats[f].materials[m].sizes[s.size] = (stats[f].materials[m].sizes[s.size]||0) + s.qty
      stats[f].materials[m].hasSizes = true
    }
  })
  return stats
}

// Звіт за останні N днів — хронологічний текст
export function buildShipmentReport(groups, days = 14) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const recent = groups.filter(g => new Date(g.date) >= cutoff)
    .sort((a,b)=>(a.date||'').localeCompare(b.date||''))

  const lines = [`📦 ВІДПРАВКИ — останні ${days} днів`, '━━━━━━━━━━━━']
  const totals = {}

  recent.forEach(g => {
    lines.push(g.firm)
    const byMat = {}
    g.positions.forEach(pos => {
      const m = pos.material || 'Без виду'
      if (!byMat[m]) byMat[m] = { total:0, sizes:{} }
      byMat[m].total += pos.qty
      if (pos.size && pos.size.trim())
        byMat[m].sizes[pos.size] = (byMat[m].sizes[pos.size]||0) + pos.qty
      totals[m] = (totals[m]||0) + pos.qty
    })
    Object.entries(byMat).forEach(([m,d])=>{
      lines.push(`  ${m}: ${d.total}`)
      Object.entries(d.sizes).forEach(([sz,q])=>lines.push(`    ${sz}: ${q}`))
    })
    lines.push(g.dateShort.split('-').reverse().join('.'))
    lines.push('')
  })

  lines.push('━━━━━━━━━━━━', 'ВСЬОГО:')
  Object.entries(totals).forEach(([m,q])=>lines.push(`${m}: ${q}`))
  return lines.join('\n')
}

// ════════ ПРИЙОМ СИРОВИНИ ══════════════════════════════════
const WOOD_TYPES = ['Здоровий', 'Тех. сировина', 'Дрова']
export { WOOD_TYPES }

export async function fetchSuppliers() {
  const r = await queryDB(DB.suppliers)
  return r.results.map(rr=>({ id:rr.id, name:p.text(rr.properties['Назва']) }))
    .filter(x=>x.name).sort((a,b)=>a.name.localeCompare(b.name,'uk'))
}
export async function addSupplier(name) {
  return createPage(DB.suppliers, { 'Назва':{ title:[{ text:{ content:name } }] } })
}
export async function deleteSupplier(pageId) { return archivePage(pageId) }

export async function fetchIntake(year, month) {
  const r = await queryDB(DB.intake, dateFilter('Дата', year, month),
    [{ property:'Дата', direction:'descending' }])
  return r.results.map(rr => {
    const q = rr.properties
    return {
      id:        rr.id,
      supplier:  p.text(q['Постачальник']),
      wood:      p.text(q['Вид лісу']),
      cubes:     p.num(q['Кубатура']),
      date:      p.date(q['Дата']),
      dateShort: (p.date(q['Дата'])||'').slice(0,10),
    }
  })
}

export async function saveIntake({ supplier, wood, cubes, date }) {
  return createPage(DB.intake, {
    'Постачальник': { title:[{ text:{ content:supplier } }] },
    'Вид лісу':     { rich_text:[{ text:{ content:wood||'' } }] },
    'Кубатура':     { number:Number(cubes)||0 },
    'Дата':         { date:{ start:date } },
  })
}

export async function updateIntake(pageId, { supplier, wood, cubes, date }) {
  const props = {}
  if (supplier!==undefined) props['Постачальник'] = { title:[{ text:{ content:supplier } }] }
  if (wood!==undefined)     props['Вид лісу']     = { rich_text:[{ text:{ content:wood||'' } }] }
  if (cubes!==undefined)    props['Кубатура']     = { number:Number(cubes)||0 }
  if (date!==undefined)     props['Дата']         = { date:{ start:date } }
  return updatePage(pageId, props)
}

export async function deleteIntake(pageId) { return archivePage(pageId) }

// Статистика по видах лісу: { total, woods:{ wood: cubes } }
export function intakeStatsByWood(rows) {
  const woods = {}
  let total = 0
  rows.forEach(r => {
    const w = r.wood || 'Без виду'
    woods[w] = (woods[w]||0) + r.cubes
    total += r.cubes
  })
  return { total, woods }
}

// Статистика по постачальниках: { supplier: { total, woods:{ wood:cubes } } }
export function intakeStatsBySupplier(rows) {
  const stats = {}
  rows.forEach(r => {
    const s = r.supplier || 'Без постачальника'
    const w = r.wood || 'Без виду'
    if (!stats[s]) stats[s] = { total:0, woods:{} }
    stats[s].total += r.cubes
    stats[s].woods[w] = (stats[s].woods[w]||0) + r.cubes
  })
  return stats
}

// Звіт прийому за останні N днів
export function buildIntakeReport(rows, days = 14) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const recent = rows.filter(r => new Date(r.date) >= cutoff)
    .sort((a,b)=>(a.date||'').localeCompare(b.date||''))

  const lines = [`🌲 ПРИЙОМ СИРОВИНИ — останні ${days} днів`, '━━━━━━━━━━━━']
  const totals = {}
  let totalAll = 0

  recent.forEach(r => {
    lines.push(r.supplier)
    lines.push(`  ${r.wood}: ${r.cubes} куб`)
    lines.push(r.dateShort.split('-').reverse().join('.'))
    lines.push('')
    totals[r.wood] = (totals[r.wood]||0) + r.cubes
    totalAll += r.cubes
  })

  lines.push('━━━━━━━━━━━━', `ВСЬОГО: ${totalAll} куб`)
  Object.entries(totals).forEach(([w,c])=>lines.push(`${w}: ${c} куб`))
  return lines.join('\n')
}

// ════════ РОЗРАХУНОК ЗАРПЛАТИ ══════════════════════════════
function isSat(d) { return new Date(d).getDay()===6 }
function isSun(d) { return new Date(d).getDay()===0 }

export function calcSalary(tgId, data) {
  const { shifts, staff, advances, bonuses, debts, debtPayments, cfg } = data
  const si = staff.find(s=>s.tgId===tgId)||{}
  const myShifts = shifts.filter(s=>s.tgId===tgId)

  const dayMap = {}
  myShifts.forEach(s => {
    const dk = s.date.slice(0,10)
    if (!dayMap[dk]) dayMap[dk] = { hours:0, packs:0, ids:[] }
    dayMap[dk].hours += s.hours
    dayMap[dk].packs += s.packs
    dayMap[dk].ids.push(s.id)
  })
  const days = Object.entries(dayMap)
    .map(([date,v])=>({date,...v}))
    .sort((a,b)=>a.date.localeCompare(b.date))

  const totalHours = days.reduce((s,d)=>s+d.hours,0)
  const totalPacks = days.reduce((s,d)=>s+d.packs,0)
  const workDays   = days.filter(d=>!isSun(d.date)).length
  const longDays   = days.filter(d=>d.hours>=cfg.longDayHours&&!isSun(d.date)).length
  const saturdays  = days.filter(d=>isSat(d.date)).length

  const rateHour = myShifts[0]?.rateHour||si.rateHour||0
  const ratePack = myShifts[0]?.ratePack||si.ratePack||0

  // Тумблери — індивідуальне вимкнення
  const bonusOff   = si.bonusOff||false
  const premiumOff = si.premiumOff||false

  // Індивідуальні налаштування з фолбеком на загальні (cfg)
  const ind = si.ind || {}
  const pick = (val, def) => (val===null||val===undefined) ? def : val
  const eMinDays   = pick(ind.minDaysForBonus, cfg.minDaysForBonus)
  const eLongBonus = pick(ind.bonusPerLongDay, cfg.bonusPerLongDay)
  const eSatBonus  = pick(ind.bonusSaturday,   cfg.bonusSaturday)
  const ePremDays  = pick(ind.premiumDays,     cfg.premiumDays)
  const ePremAmt   = pick(ind.premiumAmount,   cfg.premiumAmount)
  const eLongHours = pick(ind.longDayHours,    cfg.longDayHours)
  const eLongNeed  = pick(ind.longDaysNeeded,  cfg.longDaysNeeded)

  const longDaysCalc = days.filter(d=>d.hours>=eLongHours&&!isSun(d.date)).length

  const earnHours   = totalHours*rateHour
  const earnPacks   = totalPacks*ratePack
  const base        = earnHours+earnPacks
  const bonusActive = !bonusOff && workDays>=eMinDays
  const bonusLong   = bonusActive&&longDaysCalc>=eLongNeed ? longDaysCalc*eLongBonus : 0
  const bonusSat    = bonusActive ? saturdays*eSatBonus : 0
  const premium     = (!premiumOff && workDays>=ePremDays) ? ePremAmt : 0
  const manualBonus = bonuses.filter(b=>b.tgId===tgId).reduce((s,b)=>s+b.amount,0)
  const totalAdv    = advances.filter(a=>a.tgId===tgId).reduce((s,a)=>s+a.amount,0)
  const debtPaid    = debtPayments.filter(p=>p.tgId===tgId).reduce((s,p)=>s+p.amount,0)
  const debtInfo    = debts.find(d=>d.tgId===tgId)
  const gross       = base+bonusLong+bonusSat+premium+manualBonus
  const final       = gross-totalAdv-debtPaid
  const lastEntry   = days.length ? days[days.length-1].date : null
  const daysSinceEntry = lastEntry ? Math.floor((new Date()-new Date(lastEntry))/(864e5)) : 99

  return {
    tgId, name:si.name||'', rateHour, ratePack, staffPageId:si.id,
    bonusOff, premiumOff, ind,
    totalHours, totalPacks, workDays, longDays:longDaysCalc, saturdays, days,
    earnHours, earnPacks, base, bonusActive,
    bonusLong, bonusSat, premium, manualBonus, gross,
    totalAdv, debtPaid,
    debtRemaining: debtInfo?.remaining||0,
    debtPageId: debtInfo?.id||null,
    final,
    daysToBonus:   Math.max(0,eMinDays-workDays),
    longToBonus:   bonusActive ? Math.max(0,eLongNeed-longDaysCalc) : eLongNeed,
    daysToPremium: Math.max(0,ePremDays-workDays),
    lastEntry, daysSinceEntry,
    bonuses:  bonuses.filter(b=>b.tgId===tgId),
    advances: advances.filter(a=>a.tgId===tgId),
  }
}

export function calcAllWorkers(data) {
  const ids = [...new Set([
    ...data.shifts.map(s=>s.tgId),
    ...data.staff.map(s=>s.tgId),
  ].filter(Boolean))]

  const shiftWorkers = ids.map(id => ({
    type:'shift', ...calcSalary(id, data),
    name: data.staff.find(s=>s.tgId===id)?.name ||
          data.shifts.find(s=>s.tgId===id)?.name || `ID ${id}`,
  }))

  const fixedWorkers = data.fixedStaff.map(w => {
    const totalAdv = data.advances.filter(a=>a.tgId===w.tgId).reduce((s,a)=>s+a.amount,0)
    const debtPaid = data.debtPayments.filter(p=>p.tgId===w.tgId).reduce((s,p)=>s+p.amount,0)
    const debtInfo = data.debts.find(d=>d.tgId===w.tgId)
    return {
      type:'fixed', tgId:w.tgId, name:w.name, role:w.role, staffPageId:w.id,
      gross:w.salary, final:w.salary-totalAdv-debtPaid,
      totalAdv, debtPaid,
      debtRemaining: debtInfo?.remaining||0,
      debtPageId: debtInfo?.id||null,
      bonusOff:false, premiumOff:false,
      totalHours:0,totalPacks:0,workDays:0,longDays:0,saturdays:0,
      earnHours:0,earnPacks:0,base:0,bonusLong:0,bonusSat:0,premium:0,manualBonus:0,
      bonusActive:false,daysToBonus:0,longToBonus:0,daysToPremium:0,days:[],
      bonuses:[],advances:data.advances.filter(a=>a.tgId===w.tgId),
      daysSinceEntry:0,
    }
  })
  return [...shiftWorkers, ...fixedWorkers]
}

// ════════ ПАЛИВО ══════════════════════════════════════════
const FUEL_TYPES = ['Дизель', 'Бензин']
const FUEL_GRADES = ['А-92', 'А-95', 'А-95 Євро']
export { FUEL_TYPES, FUEL_GRADES }

export async function fetchFuel(year, month) {
  const r = await queryDB(DB.fuel, dateFilter('Дата', year, month),
    [{ property:'Дата', direction:'descending' }])
  return r.results.map(rr => {
    const q = rr.properties
    return {
      id:       rr.id,
      type:     p.text(q['Тип']),
      grade:    p.text(q['Марка']),
      liters:   p.num(q['Літри']),
      amount:   p.num(q['Сума']),
      date:     p.date(q['Дата']),
      dateShort:(p.date(q['Дата'])||'').slice(0,10),
    }
  })
}

export async function saveFuel({ type, grade, liters, amount, date }) {
  return createPage(DB.fuel, {
    'Тип':    { title:[{ text:{ content:type||'' } }] },
    'Марка':  { rich_text:[{ text:{ content:grade||'' } }] },
    'Літри':  { number:Number(liters)||0 },
    'Сума':   { number:Number(amount)||0 },
    'Дата':   { date:{ start:date } },
  })
}

export async function updateFuel(pageId, { type, grade, liters, amount, date }) {
  const props = {}
  if (type   !== undefined) props['Тип']   = { title:[{ text:{ content:type||'' } }] }
  if (grade  !== undefined) props['Марка'] = { rich_text:[{ text:{ content:grade||'' } }] }
  if (liters !== undefined) props['Літри'] = { number:Number(liters)||0 }
  if (amount !== undefined) props['Сума']  = { number:Number(amount)||0 }
  if (date   !== undefined) props['Дата']  = { date:{ start:date } }
  return updatePage(pageId, props)
}

export async function deleteFuel(pageId) { return archivePage(pageId) }

// Статистика по паливу
export function fuelStats(rows) {
  const stat = {}
  let totalAmount = 0, totalLiters = 0
  rows.forEach(r => {
    const key = r.grade ? `${r.type} ${r.grade}` : r.type
    if (!stat[key]) stat[key] = { amount:0, liters:0 }
    stat[key].amount += r.amount
    stat[key].liters += r.liters
    totalAmount += r.amount
    totalLiters += r.liters
  })
  return { totalAmount, totalLiters, byType:stat }
}

// ════════ ПОКАЗНИКИ СВІТЛА ════════════════════════════════
export async function fetchElectricity(year, month) {
  const r = await queryDB(DB.electricity, dateFilter('Дата', year, month),
    [{ property:'Дата', direction:'descending' }])
  return r.results.map(rr => {
    const q = rr.properties
    return {
      id:       rr.id,
      value:    p.num(q['Показник']),
      date:     p.date(q['Дата']),
      dateShort:(p.date(q['Дата'])||'').slice(0,10),
    }
  })
}

// Всі записи без фільтру по місяцю (для розрахунку різниці з попереднім)
export async function fetchElectricityAll() {
  const r = await queryDB(DB.electricity, undefined,
    [{ property:'Дата', direction:'ascending' }])
  return r.results.map(rr => {
    const q = rr.properties
    return {
      id:       rr.id,
      value:    p.num(q['Показник']),
      date:     p.date(q['Дата']),
      dateShort:(p.date(q['Дата'])||'').slice(0,10),
    }
  })
}

export async function saveElectricity({ value, date }) {
  return createPage(DB.electricity, {
    'Назва':    { title:[{ text:{ content:`Показник ${date}` } }] },
    'Показник': { number:Number(value)||0 },
    'Дата':     { date:{ start:date } },
  })
}

export async function updateElectricity(pageId, { value, date }) {
  const props = {}
  if (value !== undefined) props['Показник'] = { number:Number(value)||0 }
  if (date  !== undefined) props['Дата']     = { date:{ start:date } }
  return updatePage(pageId, props)
}

export async function deleteElectricity(pageId) { return archivePage(pageId) }

// Розрахунок різниці між записами + сума до оплати
export function calcElectricity(rows, tariff) {
  if (!rows.length) return []
  const sorted = [...rows].sort((a,b)=>(a.date||'').localeCompare(b.date||''))
  return sorted.map((r,i) => {
    const prev = i > 0 ? sorted[i-1].value : null
    const diff = prev !== null ? Math.max(0, r.value - prev) : null
    const amount = diff !== null ? Math.round(diff * tariff * 100) / 100 : null
    return { ...r, prev, diff, amount }
  })
}
