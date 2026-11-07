// notion.js v11 — + паливо, показники світла, доступ до палива

const DB = {
  shifts:       import.meta.env.VITE_DB_SHIFTS,
  staff:        import.meta.env.VITE_DB_STAFF,
  advances:     import.meta.env.VITE_DB_ADVANCES,
  bonuses:      import.meta.env.VITE_DB_BONUSES,
  fines:        import.meta.env.VITE_DB_FINES,
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
  settingsLog:  import.meta.env.VITE_DB_SETTINGS_LOG,
  monthClose:   import.meta.env.VITE_DB_MONTH_CLOSE,
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
  const ny = m === 11 ? y+1 : y
  const nm = m === 11 ? 0   : m+1
  return {
    start:     `${y}-${String(m+1).padStart(2,'0')}-01`,
    nextStart: `${ny}-${String(nm+1).padStart(2,'0')}-01`,
  }
}

function dateFilter(field, year, month) {
  const { start, nextStart } = monthRange(year, month)
  return { and: [
    { property: field, date: { on_or_after: start } },
    { property: field, date: { before: nextStart } },
  ]}
}

export const DEFAULT_CFG = {
  minDaysForBonus: 19, bonusPerLongDay: 100, bonusSaturday: 300,
  premiumDays: 21, premiumAmount: 4000, longDayHours: 11, longDaysNeeded: 10,
  lunchBreak: 1, electricityTariff: 0,
}

export async function fetchSettings(strict = false) {      // strict: помилку читання не маскуємо значеннями за замовчуванням
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
  } catch(e) { if (strict) throw e; return DEFAULT_CFG }
}

export async function saveSettings(pageId, cfg, onlyKeys) {
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
  if (onlyKeys) {
    const map = { lunchBreak:'Обід (год)', electricityTariff:'Тариф електрики' }
    const only = {}
    onlyKeys.forEach(k => { if (map[k]) only[map[k]] = props[map[k]] })
    return pageId && Object.keys(only).length ? updatePage(pageId, only) : undefined
  }
  if (pageId) return updatePage(pageId, props)
  return createPage(DB.settings, { 'Назва':{ title:[{ text:{ content:'Налаштування' } }] }, ...props })
}


// ════════ ІСТОРІЯ НАЛАШТУВАНЬ (діє з місяця) ═══════════════
// База «Зміни налаштувань»: Місяць (title, 2026-11), ID (number, порожньо = загальні),
// Параметр (text), Значення (text, JSON), Дата зміни (date).
// Для місяця береться остання зміна, не пізніша за цей місяць (окремо для кожної людини і параметра).
export const historyEnabled = () => !!DB.settingsLog
const monthKey = (y, m) => `${y}-${String(m+1).padStart(2,'0')}`
const HIST_CFG = ['minDaysForBonus','bonusPerLongDay','bonusSaturday','premiumDays','premiumAmount','longDayHours','longDaysNeeded']

async function fetchSettingsLog(strict = false) {          // strict: перед записом історії помилку читання не ховаємо
  if (!DB.settingsLog) return []
  try {
    const r = await queryDB(DB.settingsLog)
    return r.results.map(x => {
      const q = x.properties
      let value = null, only = false
      try { value = JSON.parse(p.text(q['Значення'])) } catch {}
      // «Тільки цей місяць» зберігається як { "v": значення, "only": true } і діє лише у своєму місяці
      if (value && typeof value==='object' && !Array.isArray(value) && 'v' in value) { only = !!value.only; value = value.v }
      return { id:x.id, month:p.text(q['Місяць']), tgId:p.numN(q['ID']), param:p.text(q['Параметр']), value, only, created:x.created_time||'' }
    }).filter(e => e.month && e.param)
  } catch(e) { if (strict) throw e; return [] }
}

// У межах одного місяця разовий запис («тільки цей місяць») сильніший за постійний
const entryRank = e => e.month + (e.only ? '~' : '')

function pickEntries(log, key) {
  // останній запис для кожної пари (ID, параметр) з місяцем <= key; разовий запис діє лише у своєму місяці
  const best = new Map()
  for (const e of log) {
    if (e.month > key) continue
    if (e.only && e.month !== key) continue
    const k = `${e.tgId??'*'}|${e.param}`
    const cur = best.get(k)
    if (!cur || entryRank(e) > entryRank(cur) || (entryRank(e) === entryRank(cur) && e.created > cur.created)) best.set(k, e)
  }
  return best
}

export function applyHistory(data, key, log) {
  if (!log.length) return data
  const best = pickEntries(log, key)
  const get = (tgId, param) => best.get(`${tgId??'*'}|${param}`)
  // tempParams — параметри, що цього місяця діють «тільки цей місяць» (щоб показати це у формах)
  const cfg = { ...data.cfg, tempParams:[] }
  HIST_CFG.forEach(k => { const e = get(null, 'cfg.'+k); if (e && e.value!==null) { cfg[k] = e.value; if (e.only) cfg.tempParams.push('cfg.'+k) } })
  const staff = data.staff.map(s => {
    const o = { ...s, ind:{ ...s.ind }, tempParams:[] }
    ;['rateHour','ratePack','bonusOff','premiumOff','lowRateOn','lowRateDays','rateHourLow','ratePackLow'].forEach(k => {
      const e = get(s.tgId, k); if (e) { o[k] = e.value; if (e.only) o.tempParams.push(k) }
    })
    HIST_CFG.forEach(k => { const e = get(s.tgId, 'ind.'+k); if (e) { o.ind[k] = e.value; if (e.only) o.tempParams.push('ind.'+k) } })
    return o
  })
  const fixedStaff = data.fixedStaff.map(f => {
    const e = get(f.tgId, 'salary'); return e ? { ...f, salary:e.value, tempParams:e.only ? ['salary'] : [] } : f
  })
  return { ...data, cfg, staff, fixedStaff }
}

// changes: [{ param, value }], tgId: null для загальних налаштувань.
// onlyThisMonth: значення діє лише в цьому місяці, далі знову діють попередні (окремий запис з позначкою only).
export async function saveSettingChanges(year, month, tgId, changes, onlyThisMonth = false) {
  await writeSettingEntries(monthKey(year, month), tgId, changes, onlyThisMonth)
}

const entryValue = valueText => ({
  'Значення':   { rich_text:[{ text:{ content:valueText } }] },
  'Дата зміни': { date:{ start:new Date().toISOString() } },
})
const newEntryProps = (key, tg, param, valueText) => ({
  'Місяць':     { title:[{ text:{ content:key } }] },
  ...(tg ? { 'ID': { number:tg } } : {}),
  'Параметр':   { rich_text:[{ text:{ content:param } }] },
  ...entryValue(valueText),
})

// Один запис на (місяць, людина, параметр, разовий/постійний): повторна зміна в тому ж місяці оновлює його, а не додає другий.
// Notion округлює час створення до хвилини, тож «остання зміна виграє» за часом створення не гарантована.
async function writeSettingEntries(key, tgId, changes, only = false) {
  if (!changes.length) return
  const tg = tgId ? Number(tgId) : null
  const log = await fetchSettingsLog(true)        // якщо історію не вдалося прочитати — не пишемо наосліп (інакше з'являться дублі)
  for (const c of changes) {
    const v = c.value ?? null
    const text = JSON.stringify(only ? { v, only:true } : v)
    const mine = log.filter(e => e.month===key && (e.tgId??null)===tg && e.param===c.param)
    const same = mine.filter(e => e.only===only)
    if (same.length) await Promise.all(same.map(e => updatePage(e.id, entryValue(text))))   // дублі (ручні правки) вирівнюємо теж
    else await createPage(DB.settingsLog, newEntryProps(key, tg, c.param, text))
    // Постійна зміна «з цього місяця» скасовує разову цього ж місяця — інакше вона б її перекривала
    if (!only) await Promise.all(mine.filter(e => e.only).map(e => archivePage(e.id)))
  }
}

// ════════ «ЗАПАМʼЯТАТИ ТЕПЕРІШНІ УМОВИ» (одноразово) ═══════════
// Записує в історію з поточного місяця те, що діє зараз, але ще не записане: ставки й умови всіх працівників і загальні налаштування.
// Із таблиць «Персонал» / «Налаштування» нічого не забирається, розрахунки не змінюються (пишуться ті самі значення, що й діють).
// Після запису в історії лишається позначка (параметр «baseline»), і кнопка в налаштуваннях зникає. Повторний запуск лише доповнює.
const BASELINE = 'baseline'
export const termsSaved = log => (log || []).some(e => e.param === BASELINE)

export async function planTermsSeed(year, month) {
  if (!DB.settingsLog) throw new Error('Не задано VITE_DB_SETTINGS_LOG')
  const key = monthKey(year, month)
  // читаємо суворо: якщо щось не прочиталось — краще помилка, ніж записати значення за замовчуванням як «теперішні»
  const [staffR, fixedR, cfg, log] = await Promise.all([queryDB(DB.staff), queryDB(DB.fixedStaff), fetchSettings(true), fetchSettingsLog(true)])
  const perm = log.filter(e => !e.only && e.param !== BASELINE)       // разові значення не рахуємо: записуємо постійні
  const recorded = pickEntries(perm, key)                              // що вже є в історії (≤ поточного місяця)
  const eff = applyHistory({ cfg, staff:staffR.results.map(parseStaff), fixedStaff:fixedR.results.map(parseFixed) }, key, perm)
  const items = [], people = new Set()
  let noId = 0
  const put = (tgId, param, value) => {
    if (value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value))) return
    if (recorded.has(`${tgId ?? '*'}|${param}`)) return
    items.push({ tgId, param, value }); if (tgId) people.add(tgId)
  }
  HIST_CFG.forEach(k => put(null, 'cfg.' + k, eff.cfg[k]))
  eff.staff.forEach(s => {
    if (!s.tgId) { noId++; return }
    put(s.tgId, 'rateHour', Number(s.rateHour)); put(s.tgId, 'ratePack', Number(s.ratePack))
    put(s.tgId, 'bonusOff', !!s.bonusOff); put(s.tgId, 'premiumOff', !!s.premiumOff); put(s.tgId, 'lowRateOn', !!s.lowRateOn)
    if (s.lowRateOn) { put(s.tgId, 'lowRateDays', s.lowRateDays); put(s.tgId, 'rateHourLow', s.rateHourLow); put(s.tgId, 'ratePackLow', s.ratePackLow) }
    HIST_CFG.forEach(k => put(s.tgId, 'ind.' + k, s.ind?.[k]))         // індивідуальні суми й умови (порожні = загальні, їх не пишемо)
  })
  eff.fixedStaff.forEach(f => { if (!f.tgId) { noId++; return } put(f.tgId, 'salary', Number(f.salary)) })
  return { key, items, people:people.size, noId }
}

// Тимчасові збої Notion (ліміт запитів, мережа) переживаємо повторами; решту помилок віддаємо одразу
const TRANSIENT = /rate|limit|timeout|timed out|fetch|network|temporar|unavailable|gateway|overload|429|50\d/i
async function withRetry(fn, tries = 4) {
  for (let t = 1, wait = 700; ; t++, wait *= 2) {
    try { return await fn() }
    catch (e) { if (t >= tries || !TRANSIENT.test(String(e?.message || ''))) throw e; await new Promise(r => setTimeout(r, wait)) }
  }
}

export async function applyTermsSeed(year, month, by, onProgress) {
  const plan = await planTermsSeed(year, month)       // свіжий стан: усе, що вже записано, пропускається (повторний запуск не дублює)
  const { key, items } = plan
  const queue = [...items]
  let done = 0, stop = false
  onProgress?.(0, items.length)
  const run = async () => {
    while (!stop && queue.length) {
      const it = queue.shift()
      try { await withRetry(() => createPage(DB.settingsLog, newEntryProps(key, it.tgId ? Number(it.tgId) : null, it.param, JSON.stringify(it.value)))) }
      catch (e) { stop = true; throw e }
      onProgress?.(++done, items.length)
    }
  }
  // два запити водночас: швидше, але в межах ліміту Notion; чекаємо обох, щоб після помилки ніщо не дописувалось у фоні
  const res = await Promise.allSettled([run(), run()])
  const bad = res.find(r => r.status === 'rejected')
  if (bad) throw bad.reason
  await withRetry(() => createPage(DB.settingsLog, newEntryProps(key, null, BASELINE, JSON.stringify({ count:items.length, by:by || '' }))))
  return { written:items.length, people:plan.people, key }
}

export const PARAM_LABELS = {
  rateHour:'Ставка за годину', ratePack:'Ставка за пачку', salary:'Фіксована зарплата',
  bonusOff:'Бонуси', premiumOff:'Премія', lowRateOn:'Знижена ставка',
  lowRateDays:'Поріг днів (знижена)', rateHourLow:'Знижена ставка за годину', ratePackLow:'Знижена ставка за пачку',
  minDaysForBonus:'Мін. днів для бонусів', bonusPerLongDay:'Бонус за довгий день', bonusSaturday:'Бонус за суботу',
  longDayHours:'Довгий день від (год)', longDaysNeeded:'Потрібно довгих днів', premiumDays:'Днів для премії', premiumAmount:'Сума премії',
}
export const paramLabel = param => PARAM_LABELS[String(param).replace(/^(ind|cfg)\./, '')] || param

// ════════ ЗАКРИТТЯ МІСЯЦЯ ═══════════════════════════════════
// База «Закриті місяці»: Місяць (title, 2026-10), Закрито (checkbox), Дата (date), Хто (text), Підсумок (text, JSON).
// Закритий місяць: підсумки зафіксовані (знімок), записи за цей місяць не створюються, не змінюються й не видаляються.
// «Відкрити знову» знімає замок (рядок лишається зі станом «не закрито»), тож автозакриття такий місяць більше не чіпає.
// Автозакриття: коли власник відкриває додаток після 22:00 останнього дня місяця (або пізніше) — без сервера й таймера.
export const closingEnabled = () => !!DB.monthClose
export const CLOSE_HOUR = 22
let CLOSED = new Map()          // ключ місяця (2026-10) → запис; оновлюється при кожному читанні, закритті й відкритті
const MONTH_NAMES = ['січень','лютий','березень','квітень','травень','червень','липень','серпень','вересень','жовтень','листопад','грудень']

const textAll = v => (v?.rich_text || v?.title || []).map(t => t.plain_text || '').join('')
const chunkText = (s, n = 1900) => {            // у Notion один фрагмент тексту ≤ 2000 символів
  const out = []; for (let i = 0; i < s.length; i += n) out.push({ text:{ content:s.slice(i, i+n) } })
  return out.length ? out : [{ text:{ content:'' } }]
}

// Що саме фіксується в знімку для кожного працівника (усе, що показують картка й списки)
const SNAP_KEYS = ['tgId','name','type','role','rateHour','ratePack','rateHourBase','ratePackBase','lowRateOn','lowRateDays','rateHourLow','ratePackLow','lowRateApplied',
  'eMinDays','eLongNeed','ePremDays','ePremAmt','eLongBonus','eSatBonus','eLongHours','bonusOff','premiumOff',
  'totalHours','totalPacks','workDays','longDays','saturdays','earnHours','earnPacks','base','bonusActive','bonusLong','bonusSat','premium','manualBonus',
  'gross','totalAdv','debtPaid','totalFines','final','daysToBonus','longToBonus','daysToPremium']
const KEEP_LIVE = new Set(['tgId','name','type','role'])      // ці поля беремо з живих даних (перейменування не псує архів)
const snapshotOf = w => { const o = {}; SNAP_KEYS.forEach(k => { if (w[k] !== undefined) o[k] = w[k] }); return o }

function parseSnapshot(v) {
  try { const j = JSON.parse(textAll(v)); return Array.isArray(j?.workers) ? j.workers : [] } catch { return [] }
}

async function loadClosedRows() {
  const r = await queryDB(DB.monthClose)
  const byKey = new Map()
  for (const x of r.results) {
    const q = x.properties, key = p.text(q['Місяць'])
    if (!key) continue
    const e = { id:x.id, key, closed:p.bool(q['Закрито']), at:p.date(q['Дата']), by:p.text(q['Хто']), snapshot:parseSnapshot(q['Підсумок']), created:x.created_time||'' }
    const cur = byKey.get(key)
    if (!cur || (e.at||e.created) > (cur.at||cur.created)) byKey.set(key, e)      // дублі (дві вкладки одночасно) — береться новіший
  }
  const list = [...byKey.values()]
  CLOSED = new Map(list.filter(e => e.closed).map(e => [e.key, e]))
  return list
}

export async function fetchClosedMonths() {
  if (!DB.monthClose) return []
  try { return await loadClosedRows() } catch(e) { console.warn('Закриті місяці:', e.message); return [] }
}

export const isMonthClosed = dateStr => !!dateStr && CLOSED.has(String(dateStr).slice(0,7))
export function assertMonthOpen(dateStr) {
  if (!isMonthClosed(dateStr)) return
  const [y, m] = String(dateStr).slice(0,7).split('-')
  throw new Error(`Цей місяць закрито (${MONTH_NAMES[Number(m)-1]} ${y}) — записи заблоковано. Власник може відкрити його знову.`)
}

// Закрити місяць: знімок підсумків (як їх бачить власник) + замок
export async function closeMonth(shared, year, month, by, md) {
  if (!DB.monthClose) throw new Error('Не задано VITE_DB_MONTH_CLOSE')
  const key = monthKey(year, month)
  const rows = await loadClosedRows()                       // свіжий стан: інший власник міг закрити раніше
  const cur = rows.find(e => e.key === key)
  if (cur?.closed) return { already:true }
  const data = md || await fetchMonthData(year, month)
  const workers = calcAllWorkers(assembleData({ ...shared, closedMonths:[] }, data, year, month))    // без знімка: рахуємо наживо
  const chunks = chunkText(JSON.stringify({ v:1, workers:workers.map(snapshotOf) }))
  // Notion у запитах віддає не більше 25 фрагментів тексту на властивість — більший знімок прочитався б обрізаним
  if (chunks.length > 24) throw new Error('Підсумок місяця завеликий для збереження в Notion — напиши розробнику')
  const props = {
    'Закрито':  { checkbox:true },
    'Дата':     { date:{ start:new Date().toISOString() } },
    'Хто':      { rich_text:[{ text:{ content:by||'' } }] },
    'Підсумок': { rich_text:chunks },
  }
  if (cur) await updatePage(cur.id, props)
  else await createPage(DB.monthClose, { 'Місяць':{ title:[{ text:{ content:key } }] }, ...props })
  await loadClosedRows()
  return { already:false }
}

// Відкрити знову: замок знімається, знімок лишається в рядку (до наступного закриття)
export async function reopenMonth(year, month, by) {
  if (!DB.monthClose) throw new Error('Не задано VITE_DB_MONTH_CLOSE')
  const key = monthKey(year, month)
  const cur = (await loadClosedRows()).find(e => e.key === key)
  if (!cur || !cur.closed) return
  await updatePage(cur.id, {
    'Закрито': { checkbox:false },
    'Дата':    { date:{ start:new Date().toISOString() } },
    'Хто':     { rich_text:[{ text:{ content:by||'' } }] },
  })
  await loadClosedRows()
}

// Який місяць пора закривати: поточний — з 22:00 його останнього дня, інакше — попередній
export function autoCloseTarget(now = new Date()) {
  const edge = new Date(now.getFullYear(), now.getMonth()+1, 0, CLOSE_HOUR, 0, 0)
  const d = now >= edge ? now : new Date(now.getFullYear(), now.getMonth()-1, 1)
  return { year:d.getFullYear(), month:d.getMonth() }
}

// Викликається, коли відкриває додаток власник. Повертає { year, month }, якщо щойно закрили місяць.
export async function autoCloseMonth(shared, by = 'авто') {
  if (!DB.monthClose) return null
  const { year, month } = autoCloseTarget()
  const key = monthKey(year, month)
  if ((shared.closedMonths||[]).some(e => e.key === key)) return null           // запис є — закритий або відкритий вручну: не чіпаємо
  if ((await loadClosedRows()).some(e => e.key === key)) return null
  const md = await fetchMonthData(year, month)
  if (!(md.shifts.length + md.advances.length + md.bonuses.length + md.fines.length + md.debtPayments.length)) return null    // порожній місяць не закриваємо
  const res = await closeMonth(shared, year, month, by, md)
  return res.already ? null : { year, month }
}

export const EMPTY_MONTH = { shifts:[], advances:[], bonuses:[], debtPayments:[], fines:[] }

// Дані, що не залежать від місяця (завантажуємо один раз)
export async function fetchShared() {
  const [staff, fixedStaff, debts, settings, settingsLog, closedMonths] = await Promise.all([
    queryDB(DB.staff),
    queryDB(DB.fixedStaff),
    queryDB(DB.debts),
    fetchSettings(),
    fetchSettingsLog(),
    fetchClosedMonths(),
  ])
  return {
    staff:       staff.results.map(parseStaff),
    fixedStaff:  fixedStaff.results.map(parseFixed),
    debts:       debts.results.map(parseDebt),
    cfg:         settings,
    settingsLog,
    closedMonths,
  }
}

// Дані конкретного місяця (кешуються окремо)
export async function fetchMonthData(year, month) {
  const df = f => dateFilter(f, year, month)
  const [shifts, advances, bonuses, debtPayments, fines] = await Promise.all([
    queryDB(DB.shifts,       df('Дата')),
    queryDB(DB.advances,     df('Дата')),
    queryDB(DB.bonuses,      df('Дата')),
    queryDB(DB.debtPayments, df('Дата')),
    DB.fines ? queryDB(DB.fines, df('Дата')) : Promise.resolve({results:[]}),
  ])
  return {
    shifts:       shifts.results.map(parseShift),
    advances:     advances.results.map(parseAdvance),
    bonuses:      bonuses.results.map(parseBonus),
    debtPayments: debtPayments.results.map(parseDP),
    fines:        fines.results.map(parseFine),
  }
}

// Склеює спільні дані й місяць, застосовуючи історію налаштувань для цього місяця
export function assembleData(shared, md, year, month) {
  const base = {
    ...md,
    staff:      shared.staff,
    fixedStaff: shared.fixedStaff,
    debts:      shared.debts,
    cfg:        shared.cfg,
  }
  const key = monthKey(year, month)
  const out = applyHistory(base, key, shared.settingsLog || [])
  // Закритий місяць: підсумки беремо зі знімка (frozen), а не рахуємо наново
  const closed = (shared.closedMonths || []).find(e => e.key === key && e.closed)
  if (!closed) return out
  return { ...out, closed:{ at:closed.at, by:closed.by }, frozen:Object.fromEntries(closed.snapshot.map(w => [w.tgId, w])) }
}

// Накладає знімок закритого місяця на живий розрахунок працівника
function withFrozen(res, data) {
  const fz = data.frozen && data.frozen[res.tgId]
  if (!fz) return res
  const out = { ...res, frozen:true }
  Object.keys(fz).forEach(k => { if (!KEEP_LIVE.has(k)) out[k] = fz[k] })
  return out
}
// Працівник, якого вже немає в живих даних (видалений), але він є в знімку закритого місяця
const ghostWorker = fz => ({ ...fz, ghost:true, frozen:true, staffPageId:null, ind:{}, tempParams:[], days:[], fines:[], bonuses:[], advances:[],
  debtRemaining:0, debtPageId:null, daysSinceEntry:0, lastEntry:null, fuelAccess:false })

export async function fetchAllData(year, month) {
  const [shared, md] = await Promise.all([fetchShared(), fetchMonthData(year, month)])
  return assembleData(shared, md, year, month)
}

export async function fetchMonthlyStats(tgId, monthsCount = 6) {
  const now = new Date()
  const results = []
  for (let i = monthsCount-1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i)
    const y = d.getFullYear(), m = d.getMonth()
    const { start, nextStart } = monthRange(y, m)
    const filter = { and: [
      { property:'ID', number:{ equals:tgId } },
      { property:'Дата', date:{ on_or_after:start } },
      { property:'Дата', date:{ before:nextStart } },
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
    lowRateOn:   p.bool(q['Знижена ставка вкл']),
    lowRateDays: p.numN(q['Поріг днів (знижена)']),
    rateHourLow: p.numN(q['Ставка в годину (знижена)']),
    ratePackLow: p.numN(q['Ставка за пачку (знижена)']),
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
function parseFine(r) {
  const q = r.properties
  return { id:r.id, tgId:p.num(q['ID']), name:p.text(q['ПІБ']), date:p.date(q['Дата']),
    amount:p.num(q['Сума штрафу']), reason:p.text(q['Причина']) }
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
  assertMonthOpen(date)
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

export async function updateShift(pageId, { hours, packs, rateHour, ratePack, lunchBreak=0, date }) {
  assertMonthOpen(date)
  const actualHours = Math.max(0, hours - lunchBreak)
  return updatePage(pageId, {
    'Години':                    { number:actualHours },
    'Кількість збитих пачок':    { number:packs },
    'Виробіток з годин':         { number:actualHours*rateHour },
    'Виробіток зі збитих пачок': { number:packs*ratePack },
  })
}

// Видалення зміни (архівує всі записи за день)
export async function deleteShift(pageIds, date) {
  assertMonthOpen(date)
  for (const id of pageIds) { await archivePage(id) }
}

// Повне видалення працівника: всі зміни + аванси + премії + борги + сам запис у Персонал (крім записів закритих місяців)
export async function deleteWorkerCompletely(tgId, staffPageId) {
  const filterByTg = {
    property: 'ID', number: { equals: Number(tgId) },
  }

  const [shiftsR, advR, bonusR, debtR, debtPayR, fineR] = await Promise.all([
    queryDB(DB.shifts,       filterByTg),
    queryDB(DB.advances,     filterByTg),
    queryDB(DB.bonuses,      filterByTg),
    queryDB(DB.debts,        filterByTg),
    queryDB(DB.debtPayments, filterByTg),
    DB.fines ? queryDB(DB.fines, filterByTg) : Promise.resolve({results:[]}),
  ])

  // Записи закритих місяців не чіпаємо: архів лишається цілим (борги без дати видаляються як раніше)
  const dated = [...shiftsR.results, ...advR.results, ...bonusR.results, ...debtPayR.results, ...fineR.results]
  const keep  = dated.filter(r => isMonthClosed(r.properties?.['Дата']?.date?.start))
  const allIds = [
    ...dated.filter(r => !keep.includes(r)),
    ...debtR.results,
  ].map(r => r.id)

  for (const id of allIds) { await archivePage(id) }
  if (staffPageId) await archivePage(staffPageId)

  return { deletedRecords: allIds.length, keptInClosed: keep.length, staffDeleted: !!staffPageId }
}

export async function saveBonusRecord({ tgId, name, date, amount, reason }) {
  assertMonthOpen(date)
  return createPage(DB.bonuses, {
    'ПІБ':         { title:[{ text:{ content:name } }] },
    'ID':          { number:tgId },
    'Дата':        { date:{ start:date } },
    'Сума премії': { number:amount },
    'Причина':     { rich_text:[{ text:{ content:reason||'' } }] },
  })
}

export async function saveFine({ tgId, name, date, amount, reason }) {
  if (!DB.fines) throw new Error('Не задано VITE_DB_FINES')
  assertMonthOpen(date)
  return createPage(DB.fines, {
    'ПІБ':          { title:[{ text:{ content:name } }] },
    'ID':           { number:tgId },
    'Дата':         { date:{ start:date } },
    'Сума штрафу':  { number:amount },
    'Причина':      { rich_text:[{ text:{ content:reason||'' } }] },
  })
}

// Корекція штрафу (дата, сума, причина) і видалення
export async function updateFine(pageId, { date, amount, reason, oldDate }) {
  if (!DB.fines) throw new Error('Не задано VITE_DB_FINES')
  assertMonthOpen(oldDate); assertMonthOpen(date)
  return updatePage(pageId, {
    'Дата':        { date:{ start:date } },
    'Сума штрафу': { number:Number(amount) },
    'Причина':     { rich_text:[{ text:{ content:reason||'' } }] },
  })
}
export async function deleteFine(pageId, date) { assertMonthOpen(date); return archivePage(pageId) }

export async function saveAdvance({ tgId, name, date, amount }) {
  assertMonthOpen(date)
  return createPage(DB.advances, {
    'ПІБ':         { title:[{ text:{ content:name } }] },
    'ID':          { number:tgId },
    'Дата':        { date:{ start:date } },
    'Сума авансу': { number:amount },
  })
}

export async function saveDebtPayment({ tgId, name, date, amount, debtPageId, currentRemaining }) {
  assertMonthOpen(date)
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
export async function updateStaffToggles(pageId, { bonusOff, premiumOff, ind, fuelAccess, lowRateOn, lowRateDays, rateHourLow, ratePackLow }) {
  const props = {}
  if (bonusOff   !== undefined) props['Бонуси вимкнено'] = { checkbox: bonusOff }
  if (premiumOff !== undefined) props['Премії вимкнено'] = { checkbox: premiumOff }
  if (fuelAccess !== undefined) props['Доступ до палива'] = { checkbox: fuelAccess }
  if (lowRateOn  !== undefined) props['Знижена ставка вкл'] = { checkbox: lowRateOn }
  const setNumTop = (key, val) => {
    if (val === '' || val === null || val === undefined) props[key] = { number: null }
    else props[key] = { number: Number(val) }
  }
  if (lowRateDays !== undefined) setNumTop('Поріг днів (знижена)', lowRateDays)
  if (rateHourLow !== undefined) setNumTop('Ставка в годину (знижена)', rateHourLow)
  if (ratePackLow !== undefined) setNumTop('Ставка за пачку (знижена)', ratePackLow)
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
  try {
    return await updatePage(pageId, props)
  } catch (e) {
    // Нові колонки (паливо / знижена ставка) ще можуть бути відсутні в Notion —
    // тоді зберігаємо решту й чітко кажемо, чого не вистачає.
    const optional = ['Доступ до палива','Знижена ставка вкл','Поріг днів (знижена)','Ставка в годину (знижена)','Ставка за пачку (знижена)']
    const missing = optional.filter(k => k in props && String(e.message).includes(k))
    if (!missing.length) throw e
    const rest = { ...props }
    optional.forEach(k => delete rest[k])
    if (Object.keys(rest).length) await updatePage(pageId, rest)
    throw new Error(`Збережено, але в Notion (Персонал) немає колонок: ${missing.join(', ')}. Додай їх і збережи ще раз.`)
  }
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
  const fines = data.fines || []
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

  // Поточна ставка з картки працівника має пріоритет.
  // Ставка зі зміни — лише запасний варіант для працівників без картки в «Персонал».
  // Якщо увімкнена «знижена ставка» і робочих днів менше порогу — застосовуємо знижену.
  const useLowRate = si.lowRateOn && workDays < (si.lowRateDays??19)
  const rateHour = useLowRate
    ? (si.rateHourLow??si.rateHour??myShifts[0]?.rateHour??0)
    : (si.rateHour||myShifts[0]?.rateHour||0)
  const ratePack = useLowRate
    ? (si.ratePackLow??si.ratePack??myShifts[0]?.ratePack??0)
    : (si.ratePack||myShifts[0]?.ratePack||0)

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
  const totalFines  = fines.filter(f=>f.tgId===tgId).reduce((s,f)=>s+f.amount,0)
  const debtPaid    = debtPayments.filter(p=>p.tgId===tgId).reduce((s,p)=>s+p.amount,0)
  const debtInfo    = debts.find(d=>d.tgId===tgId)
  const gross       = base+bonusLong+bonusSat+premium+manualBonus
  const final       = gross-totalAdv-debtPaid-totalFines
  const lastEntry   = days.length ? days[days.length-1].date : null
  const daysSinceEntry = lastEntry ? Math.floor((new Date()-new Date(lastEntry))/(864e5)) : 99

  return withFrozen({
    tgId, name:si.name||'', rateHour, ratePack, rateHourBase:si.rateHour||0, ratePackBase:si.ratePack||0, staffPageId:si.id,
    lowRateOn:si.lowRateOn||false, lowRateDays:si.lowRateDays??19,
    rateHourLow:si.rateHourLow??null, ratePackLow:si.ratePackLow??null,
    lowRateApplied:useLowRate,
    eMinDays, eLongNeed, ePremDays, ePremAmt, eLongBonus, eSatBonus, eLongHours,
    bonusOff, premiumOff, ind, fuelAccess:si.fuelAccess||false, tempParams:si.tempParams||[],
    totalHours, totalPacks, workDays, longDays:longDaysCalc, saturdays, days,
    earnHours, earnPacks, base, bonusActive,
    bonusLong, bonusSat, premium, manualBonus, gross,
    totalAdv, debtPaid, totalFines,
    fines: fines.filter(f=>f.tgId===tgId),
    debtRemaining: debtInfo?.remaining||0,
    debtPageId: debtInfo?.id||null,
    final,
    daysToBonus:   Math.max(0,eMinDays-workDays),
    longToBonus:   bonusActive ? Math.max(0,eLongNeed-longDaysCalc) : eLongNeed,
    daysToPremium: Math.max(0,ePremDays-workDays),
    lastEntry, daysSinceEntry,
    bonuses:  bonuses.filter(b=>b.tgId===tgId),
    advances: advances.filter(a=>a.tgId===tgId),
  }, data)
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
    const fines = (data.fines||[]).filter(f=>f.tgId===w.tgId)
    const totalFines = fines.reduce((s,f)=>s+f.amount,0)
    const debtInfo = data.debts.find(d=>d.tgId===w.tgId)
    return withFrozen({
      type:'fixed', tgId:w.tgId, name:w.name, role:w.role, staffPageId:w.id,
      gross:w.salary, tempParams:w.tempParams||[], final:w.salary-totalAdv-debtPaid-totalFines,
      totalAdv, debtPaid, totalFines, fines,
      debtRemaining: debtInfo?.remaining||0,
      debtPageId: debtInfo?.id||null,
      bonusOff:false, premiumOff:false,
      totalHours:0,totalPacks:0,workDays:0,longDays:0,saturdays:0,
      earnHours:0,earnPacks:0,base:0,bonusLong:0,bonusSat:0,premium:0,manualBonus:0,
      bonusActive:false,daysToBonus:0,longToBonus:0,daysToPremium:0,days:[],
      bonuses:[],advances:data.advances.filter(a=>a.tgId===w.tgId),
      daysSinceEntry:0,
    }, data)
  })
  // Закритий місяць: працівники, яких уже нема в живих даних, лишаються в архіві зі знімка
  const have = new Set([...shiftWorkers, ...fixedWorkers].map(w=>w.tgId))
  const ghosts = Object.values(data.frozen || {}).filter(fz => !have.has(fz.tgId)).map(ghostWorker)
  return [...shiftWorkers, ...fixedWorkers, ...ghosts]
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
