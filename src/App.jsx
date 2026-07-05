import { useState, useEffect, useCallback } from 'react'
import { t, tMonths, useLang, LANGS, CURRENCIES, curSymbol } from './i18n.js'
import {
  OWNER_IDS, fetchAllData, saveSettings, calcSalary, calcAllWorkers,
  fmt, fmtH, todayStr,
  saveShift, updateShift, deleteShift,
  saveAdvance, saveBonus, addDebt, saveDebtPayment,
  addStaff, updateStaffRates, updateStaffInfo, deleteStaff, writeLog,
} from './notion.js'

// ════════════════════════════════════════════════════════
// КОЛЬОРОВА СХЕМА — через CSS-змінні (для перемикання тем без ререндеру)
// ════════════════════════════════════════════════════════
const C = {
  bg:        'var(--bg)',
  card:      'var(--card)',
  border:    'var(--border)',
  border2:   'var(--border2)',
  text:      'var(--text)',
  dim:       'var(--dim)',
  muted:     'var(--muted)',
  blue:      'var(--blue)',
  blueDark:  'var(--blueDark)',
  blueSoft:  'var(--blueSoft)',
  blueSoft2: 'var(--blueSoft2)',
  green:     'var(--green)',
  greenSoft: 'var(--greenSoft)',
  red:       'var(--red)',
  redSoft:   'var(--redSoft)',
  gray:      'var(--gray)',
}
const THEMES = ['light', 'dark']
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('budcon_theme') || 'light' } catch { return 'light' }
  })
  useEffect(() => {
    try {
      localStorage.setItem('budcon_theme', theme)
      document.documentElement.setAttribute('data-theme', theme)
    } catch {}
  }, [theme])
  return [theme, setTheme]
}
const F = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif"
const DOW_SHORT = {
  uk: ['нд','пн','вт','ср','чт','пт','сб'],
  en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
  cs: ['ne','po','út','st','čt','pá','so'],
}
const MONTH_SHORT = {
  uk: ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'],
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  cs: ['led','úno','bře','dub','kvě','čvn','čvc','srp','zář','říj','lis','pro'],
}
function dowShort(dateStr, lang) {
  const d = new Date((dateStr||'')+'T00:00:00')
  return DOW_SHORT[lang]?.[d.getDay()] ?? ''
}
function dayNum(dateStr) { return (dateStr||'').slice(8,10) }
function monShort(dateStr, lang) {
  const d = new Date((dateStr||'')+'T00:00:00')
  return MONTH_SHORT[lang]?.[d.getMonth()] ?? ''
}

// ════════════════════════════════════════════════════════
// TELEGRAM HELPERS
// ════════════════════════════════════════════════════════
function getTelegramUser() {
  try {
    const tg = window.Telegram?.WebApp
    tg?.ready?.()
    tg?.expand?.()
    const u = tg?.initDataUnsafe?.user
    if (u) return { id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'User' }
  } catch {}
  return { id: 0, name: 'Dev' }
}

function vibrate(type) {
  try {
    const tg = window.Telegram?.WebApp
    if (!tg?.HapticFeedback) return
    if (type === 'success' || type === 'error') tg.HapticFeedback.notificationOccurred(type)
    else tg.HapticFeedback.impactOccurred(type || 'light')
  } catch {}
}

// ════════════════════════════════════════════════════════
// СПІЛЬНІ UI-ЕЛЕМЕНТИ
// ════════════════════════════════════════════════════════
const inp = {
  width: '100%', background: C.gray, border: `1px solid ${C.border}`,
  borderRadius: 12, padding: '13px 14px', fontSize: 15, color: C.text,
  fontFamily: F, boxSizing: 'border-box',
}

const primaryBtn = { background: C.blue, color: '#fff', border: 'none', borderRadius: 14, padding: '14px 12px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: F }
const secondaryBtn = { background: C.blueSoft, color: C.blue, border: 'none', borderRadius: 14, padding: '14px 12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F }
const dangerBtn = { background: C.redSoft, color: C.red, border: 'none', borderRadius: 14, padding: '14px 12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F }

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 16, padding: 16, ...style }}>{children}</div>
)

const Lbl = ({ children, style = {} }) => (
  <div style={{ fontSize: 13, color: C.dim, marginBottom: 8, fontWeight: 500, fontFamily: F, ...style }}>{children}</div>
)

const Row = ({ label, value, color = C.text, bold = false, last = false }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '9px 0', borderBottom: last ? 'none' : `1px solid ${C.border2}`,
  }}>
    <span style={{ fontSize: 14, color: C.dim, fontFamily: F }}>{label}</span>
    <span style={{ fontSize: bold ? 17 : 14, fontWeight: bold ? 800 : 600, color, fontFamily: F }}>{value}</span>
  </div>
)

// Аватар-заглушка (кружок з іконкою людини)
function Avatar({ size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: C.gray,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
    }}>
      <svg width={size*0.55} height={size*0.55} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" fill="var(--muted)"/>
        <path d="M4 20c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" fill="var(--muted)"/>
      </svg>
    </div>
  )
}

// Кольоровий круг з іконкою (для radio-рядків і action-кнопок)
function IconCircle({ children, bg = C.blueSoft, size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: size*0.45 }}>
      {children}
    </div>
  )
}

function Toggle({ on, onClick }) {
  return (
    <div onClick={onClick} style={{ width: 44, height: 26, borderRadius: 13, background: on ? '#34C759' : C.border, position: 'relative', transition: 'all .2s', flexShrink: 0, cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'all .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </div>
  )
}

// Радіо-рядок вибору режиму (іконка + текст + радіо-кружок)
function RadioRow({ icon, iconBg, title, desc, selected, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px', cursor: 'pointer', background: selected ? C.blueSoft : 'transparent', borderRadius: 12, marginBottom: 2 }}>
      <IconCircle bg={selected ? C.blueSoft2 : C.gray}>{icon}</IconCircle>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F }}>{title}</div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 2, fontFamily: F }}>{desc}</div>
      </div>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        border: selected ? 'none' : `2px solid ${C.border}`,
        background: selected ? C.blue : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
      </div>
    </div>
  )
}

// Рядок-навігація в налаштуваннях (іконка + назва + значення + шеврон)
function SettingsRow({ icon, title, value, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px', cursor: onClick ? 'pointer' : 'default' }}>
      {icon && <IconCircle bg={C.blueSoft} size={34}>{icon}</IconCircle>}
      <div style={{ flex: 1, fontSize: 15, color: C.text, fontFamily: F, fontWeight: 500 }}>{title}</div>
      {value !== undefined && <div style={{ fontSize: 14, color: C.dim, fontFamily: F }}>{value}</div>}
      {onClick && <span style={{ color: C.muted, fontSize: 16 }}>›</span>}
    </div>
  )
}

function Sheet({ onClose, title, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: C.bg, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', padding: '10px 18px 28px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '4px auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: F }}>{title}</div>
          <button onClick={onClose} style={{ background: C.gray, border: 'none', borderRadius: '50%', width: 30, height: 30, color: C.dim, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FlagSwitcher({ lang, setLang }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: C.card, borderRadius: 14, padding: 4, border: `1px solid ${C.border}` }}>
      {LANGS.map(l => (
        <button key={l.code} onClick={() => setLang(l.code)} style={{
          width: 30, height: 26, borderRadius: 9, fontSize: 15, cursor: 'pointer',
          border: 'none', background: lang === l.code ? C.blueSoft : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{l.flag}</button>
      ))}
    </div>
  )
}

// Маленька кнопка-перемикач теми ☀️/🌙
function ThemeToggle({ theme, setTheme }) {
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{
      width: 34, height: 34, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
    }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
  )
}

// Головний заголовок (☰ + назва + мовний перемикач) — для екранів нижнього меню
function TopHeader({ title, onMenu, lang, setLang, theme, setTheme }) {
  return (
    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg }}>
      <button onClick={onMenu} style={{ background: 'transparent', border: 'none', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h18" stroke={C.text} strokeWidth="2" strokeLinecap="round"/></svg>
      </button>
      <div style={{ fontSize: 19, fontWeight: 800, color: C.text, fontFamily: F }}>{title}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <FlagSwitcher lang={lang} setLang={setLang} />
      </div>
    </div>
  )
}

// Заголовок під-сторінки (← назад + назва + опційно право)
function BackHeader({ title, sub, onBack, right }) {
  return (
    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: C.bg }}>
      <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, width: 34, height: 34, color: C.text, fontSize: 17, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: F }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: C.dim, marginTop: 1, fontFamily: F }}>{sub}</div>}
      </div>
      {right}
    </div>
  )
}

// Синя градієнтна hero-картка з сумою
function HeroCard({ label, amount, sub, children }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #4E8DF5 0%, #3B6FEA 100%)',
      borderRadius: 20, padding: '22px 20px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.18 }}>
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h13a1 1 0 011 1v2M3 7v10a2 2 0 002 2h14a2 2 0 002-2v-7a1 1 0 00-1-1H5a2 2 0 00-2-2z" stroke="#fff" strokeWidth="1.3"/><circle cx="16" cy="13" r="1.4" fill="#fff"/></svg>
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontFamily: F, lineHeight: 1.4, whiteSpace: 'pre-line', position: 'relative' }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', fontFamily: F, marginTop: 8, letterSpacing: '-0.02em', position: 'relative' }}>{amount}</div>
      {sub && <div style={{ marginTop: 4, position: 'relative' }}>{sub}</div>}
      {children}
    </div>
  )
}

// Нижнє меню навігації
function BottomNav({ items, active, onChange }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, background: C.card,
      borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-around',
      padding: '8px 4px calc(8px + env(safe-area-inset-bottom))', zIndex: 20,
    }}>
      {items.map(it => {
        const isActive = active === it.key
        if (it.center) {
          return (
            <button key={it.key} onClick={() => onChange(it.key)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              marginTop: -22, flex: 1,
            }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.4)' }}>
                <span style={{ color: '#fff', fontSize: 24, fontWeight: 400, lineHeight: 1 }}>+</span>
              </div>
              <span style={{ fontSize: 10.5, color: C.dim, fontFamily: F, marginTop: 2 }}>{it.label}</span>
            </button>
          )
        }
        return (
          <button key={it.key} onClick={() => onChange(it.key)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', flex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 0',
          }}>
            <span style={{ color: isActive ? C.blue : C.muted, display: 'flex' }}>{it.icon}</span>
            <span style={{ fontSize: 10.5, color: isActive ? C.blue : C.muted, fontFamily: F, fontWeight: isActive ? 700 : 500 }}>{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Іконки для нижнього меню (SVG, щоб не залежати від бібліотек) ──
const IcoTeam = (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke={c} strokeWidth="1.8"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" stroke={c} strokeWidth="1.8"/><circle cx="17" cy="8" r="2.4" stroke={c} strokeWidth="1.8"/><path d="M15.5 14.7c2.6.3 4.5 2.2 4.5 5.3" stroke={c} strokeWidth="1.8"/></svg>
const IcoClock = (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke={c} strokeWidth="1.8"/><path d="M12 7.5V12l3.2 2" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>
const IcoChart = (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M11 20V4M18 20v-7" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>
const IcoPlus  = (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>

function MonthPicker({ year, month, onChange, lang }) {
  const months = tMonths(lang)
  function prev() { let y = year, m = month - 1; if (m < 0) { m = 11; y-- } onChange(y, m) }
  function next() { let y = year, m = month + 1; if (m > 11) { m = 0; y++ } onChange(y, m) }
  const navBtn = { background: C.gray, border: 'none', borderRadius: 9, width: 30, height: 30, color: C.text, fontSize: 16, cursor: 'pointer', fontFamily: F }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.card, border: `1px solid ${C.border2}`, borderRadius: 14, padding: '8px 10px' }}>
      <button onClick={prev} style={navBtn}>‹</button>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: F }}>{months[month]} {year}</div>
      <button onClick={next} style={navBtn}>›</button>
    </div>
  )
}

function LoadingScreen({ lang }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim, fontSize: 14, fontFamily: F }}>
      {t('loading', lang)}
    </div>
  )
}

function NotRegisteredScreen({ lang, setLang, tgId }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: F }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}><FlagSwitcher lang={lang} setLang={setLang} /></div>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🏗️</div>
      <div style={{ color: C.text, fontSize: 15, textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{t('notRegistered', lang)}</div>
      <div style={{ color: C.muted, fontSize: 12, marginTop: 16, fontFamily: F }}>ID: {tgId}</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// ФОРМА ЗМІНИ
// ════════════════════════════════════════════════════════
function ShiftForm({ worker, allWorkers, isOwner, onClose, onSaved, tgId, tgName, cfg, lang, cur }) {
  const lb = cfg?.lunchBreak ?? 1
  const workMode = cfg?.workMode || 'mixed'
  const [selId, setSelId] = useState(worker?.tgId || tgId)
  const [type, setType] = useState(workMode === 'm2' ? 'm2' : 'hours')
  const [hoursMode, setHoursMode] = useState('range')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [date, setDate] = useState(todayStr())
  const [hours, setHours] = useState('')
  const [m2, setM2] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const sel = isOwner ? (allWorkers.find(w => w.tgId === Number(selId)) || worker) : worker

  const typeOptions = workMode === 'hours' ? [['hours', t('typeHours', lang)]]
    : workMode === 'm2' ? [['m2', t('typeM2', lang)]]
    : [['hours', t('typeHours', lang)], ['m2', t('typeM2', lang)], ['mixed', t('typeMixed', lang)]]

  function parseTime(s) {
    if (!s) return null
    const str = String(s).trim()
    if (str.includes(':')) { const [h, m] = str.split(':').map(Number); return h + (m || 0) / 60 }
    if (str.includes('.')) {
      const [h, m] = str.split('.').map(Number)
      if ((m || 0) < 6) return parseFloat(str)
      return h + (m || 0) / 60
    }
    const n = parseFloat(str)
    if (!isNaN(n)) { if (n >= 100) return Math.floor(n / 100) + (n % 100) / 60; return n }
    return null
  }

  const fromH = parseTime(timeFrom)
  const toH = parseTime(timeTo)
  const rangeH = (fromH !== null && toH !== null && toH > fromH) ? Math.round((toH - fromH) * 10) / 10 : null
  const rawH = hoursMode === 'range' ? (rangeH || 0) : (parseFloat(hours) || 0)
  const effLb = hoursMode === 'range' ? lb : 0
  const actualH = Math.max(0, rawH - effLb)
  const earn = actualH * (sel?.rateHour || 0) + (parseFloat(m2) || 0) * (sel?.rateM2 || 0)

  async function submit(e) {
    e.preventDefault()
    const h = type === 'm2' ? 0 : rawH
    const mm = type === 'hours' ? 0 : (parseFloat(m2) || 0)
    if (!h && !mm) { setError(t('enterHoursOrM2', lang)); return }
    if (hoursMode === 'range' && rangeH === null && type !== 'm2') { setError(t('checkTime', lang)); return }
    try {
      setLoading(true); setError(null)
      await saveShift({ tgId: sel.tgId, name: sel.name, rateHour: sel.rateHour || 0, rateM2: sel.rateM2 || 0, date, hours: h, m2: mm, lunchBreak: effLb })
      const detail = hoursMode === 'range' && timeFrom && timeTo
        ? `${date}: ${timeFrom}–${timeTo} (${fmtH(h)}${t('hr', lang)}) ${mm ? mm + t('m2short', lang) : ''}`
        : `${date}: ${h}${t('hr', lang)} ${mm ? mm + t('m2short', lang) : ''}`
      await writeLog({ tgId: isOwner ? tgId : sel.tgId, name: sel.name, action: 'Shift', details: detail })
      vibrate('success')
      setResult({ hours: h, actualH: Math.max(0, h - effLb), m2: mm, earned: Math.max(0, h - effLb) * (sel.rateHour || 0) + mm * (sel.rateM2 || 0), date, timeFrom, timeTo, lbApplied: effLb })
      setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 1800)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  if (success && result) return (
    <Sheet onClose={onClose} title={t('shiftSaved', lang)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>📅 {result.date}</div>
          {result.hours > 0 && <>
            {result.timeFrom && result.timeTo && <Row label={t('workTime', lang)} value={`${result.timeFrom} – ${result.timeTo}`} color={C.dim} />}
            <Row label={t('enteredHours', lang)} value={`${fmtH(result.hours)} ${t('hr', lang)}`} color={C.dim} />
            {result.lbApplied > 0 && <Row label={`${t('afterLunch', lang)} (-${result.lbApplied} ${t('hr', lang)})`} value={`${fmtH(result.actualH)} ${t('hr', lang)}`} color={C.text} />}
          </>}
          {result.m2 > 0 && <Row label={t('m2Field', lang)} value={`${result.m2} ${t('m2short', lang)}`} color={C.text} />}
          <Row label={t('earned', lang)} value={`${fmt(result.earned)} ${cur}`} color={C.green} bold last />
        </Card>
      </div>
    </Sheet>
  )

  return (
    <Sheet onClose={onClose} title={t('newShift', lang)}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isOwner && allWorkers?.length > 1 && (
          <div>
            <Lbl>{t('worker', lang)}</Lbl>
            <select value={selId} onChange={e => setSelId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              {allWorkers.map(w => <option key={w.tgId} value={w.tgId}>{w.name}</option>)}
            </select>
          </div>
        )}

        {typeOptions.length > 1 && (
          <div>
            <Lbl>{t('shiftType', lang)}</Lbl>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${typeOptions.length}, 1fr)`, gap: 8 }}>
              {typeOptions.map(([k, l]) => (
                <button key={k} type="button" onClick={() => setType(k)} style={{
                  padding: '10px 4px', borderRadius: 10, fontSize: 12, fontFamily: F, cursor: 'pointer',
                  fontWeight: type === k ? 700 : 500, border: 'none',
                  background: type === k ? C.blue : C.gray,
                  color: type === k ? '#fff' : C.dim,
                }}>{l}</button>
              ))}
            </div>
          </div>
        )}

        <div><Lbl>{t('date', lang)}</Lbl>
          <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} style={inp} />
        </div>

        {type !== 'm2' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Lbl style={{ margin: 0 }}>{t('hoursMode', lang)}</Lbl>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['range', t('modeRange', lang)], ['manual', t('modeManual', lang)]].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setHoursMode(k)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: F, cursor: 'pointer', border: 'none',
                    background: hoursMode === k ? C.blueSoft : C.gray,
                    color: hoursMode === k ? C.blue : C.dim, fontWeight: hoursMode === k ? 700 : 500,
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {hoursMode === 'range' ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{t('from', lang)}</div>
                  <input value={timeFrom} onChange={e => setTimeFrom(e.target.value)} placeholder="7 / 7:00" style={inp} inputMode="decimal" />
                </div>
                <div style={{ color: C.dim, fontSize: 18, paddingTop: 18 }}>→</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{t('to', lang)}</div>
                  <input value={timeTo} onChange={e => setTimeTo(e.target.value)} placeholder="17 / 17:00" style={inp} inputMode="decimal" />
                </div>
              </div>
            ) : (
              <input type="number" inputMode="decimal" step="0.5" min="0" max="24" value={hours} onChange={e => setHours(e.target.value)} placeholder="10" style={inp} />
            )}

            {rawH > 0 && (
              <div style={{ fontSize: 12, color: C.text, marginTop: 8, padding: '8px 12px', background: C.blueSoft, borderRadius: 10, fontFamily: F }}>
                {hoursMode === 'range'
                  ? <>{fmtH(rangeH)} {t('hr', lang)} − {lb} {t('lunchBreakLbl', lang)} = <b>{fmtH(actualH)} {t('hr', lang)}</b> · {fmt(actualH * (sel?.rateHour || 0))} {cur}</>
                  : <><b>{fmtH(actualH)} {t('hr', lang)}</b> · {fmt(actualH * (sel?.rateHour || 0))} {cur}</>}
              </div>
            )}
          </div>
        )}

        {type !== 'hours' && (
          <div><Lbl>{t('m2', lang)}</Lbl>
            <input type="number" inputMode="decimal" min="0" step="0.1" value={m2} onChange={e => setM2(e.target.value)} placeholder="напр. 25" style={inp} />
            {m2 && (sel?.rateM2 || 0) > 0 && <div style={{ fontSize: 12, color: C.text, marginTop: 6, fontFamily: F }}>= {fmt(parseFloat(m2) * (sel?.rateM2 || 0))} {cur}</div>}
          </div>
        )}

        {earn > 0 && (
          <div style={{ background: C.blueSoft, borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: C.dim, fontFamily: F }}>{t('perShift', lang)}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.blue, fontFamily: F }}>{fmt(earn)} {cur}</span>
          </div>
        )}

        {error && <div style={{ color: C.red, fontSize: 13, padding: '10px 14px', background: C.redSoft, borderRadius: 10 }}>⚠ {error}</div>}
        <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
          {loading ? t('saving', lang) : t('saveShift', lang)}
        </button>
      </form>
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════
// ФОРМА АВАНСУ
// ════════════════════════════════════════════════════════
function AdvanceForm({ worker, allWorkers, isOwner, onClose, onSaved, tgId, tgName, lang, cur }) {
  const [selId, setSelId] = useState(worker?.tgId || tgId)
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const sel = isOwner ? (allWorkers.find(w => w.tgId === Number(selId)) || worker) : worker

  async function submit(e) {
    e.preventDefault()
    const a = parseFloat(amount) || 0
    if (!a) { setError(t('amount', lang)); return }
    try {
      setLoading(true); setError(null)
      await saveAdvance({ tgId: sel.tgId, name: sel.name, date, amount: a })
      await writeLog({ tgId: isOwner ? tgId : sel.tgId, name: sel.name, action: 'Advance', details: `${date}: ${a} ${cur}` })
      vibrate('success')
      setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 1300)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  if (success) return (
    <Sheet onClose={onClose} title={t('advanceSaved', lang)}>
      <div style={{ textAlign: 'center', padding: 20, fontSize: 28, fontWeight: 800, color: C.blue, fontFamily: F }}>{fmt(amount)} {cur}</div>
    </Sheet>
  )

  return (
    <Sheet onClose={onClose} title={t('newAdvance', lang)}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isOwner && allWorkers?.length > 1 && (
          <div><Lbl>{t('worker', lang)}</Lbl>
            <select value={selId} onChange={e => setSelId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              {allWorkers.map(w => <option key={w.tgId} value={w.tgId}>{w.name}</option>)}
            </select>
          </div>
        )}
        <div><Lbl>{t('date', lang)}</Lbl><input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} style={inp} /></div>
        <div><Lbl>{t('amount', lang)}</Lbl><input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" style={inp} /></div>
        {error && <div style={{ color: C.red, fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? t('saving', lang) : t('save', lang)}
        </button>
      </form>
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════
// ФОРМА БОНУСУ (РУЧНОГО)
// ════════════════════════════════════════════════════════
function BonusForm({ worker, onClose, onSaved, tgId, lang, cur }) {
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    const a = parseFloat(amount) || 0
    if (!a) return
    try {
      setLoading(true); setError(null)
      await saveBonus({ tgId: worker.tgId, name: worker.name, date, amount: a, note })
      await writeLog({ tgId, name: worker.name, action: 'Bonus', details: `${date}: ${a} ${cur}${note ? ' — ' + note : ''}` })
      vibrate('success'); setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 1300)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  if (success) return (
    <Sheet onClose={onClose} title={t('bonusSaved', lang)}>
      <div style={{ textAlign: 'center', padding: 20, fontSize: 28, fontWeight: 800, color: C.green, fontFamily: F }}>+{fmt(amount)} {cur}</div>
    </Sheet>
  )

  return (
    <Sheet onClose={onClose} title={`${t('addBonus', lang)} — ${worker.name}`}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><Lbl>{t('date', lang)}</Lbl><input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} style={inp} /></div>
        <div><Lbl>{t('amount', lang)}</Lbl><input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500" style={inp} /></div>
        <div><Lbl>{t('bonusNote', lang)}</Lbl><input value={note} onChange={e => setNote(e.target.value)} style={inp} /></div>
        {error && <div style={{ color: C.red, fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? t('saving', lang) : t('save', lang)}
        </button>
      </form>
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════
// ФОРМА БОРГУ (ВИДАТИ / ПОГАСИТИ)
// ════════════════════════════════════════════════════════
function DebtForm({ worker, mode, onClose, onSaved, tgId, lang, cur }) {
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    const a = parseFloat(amount) || 0
    if (!a) return
    try {
      setLoading(true); setError(null)
      if (mode === 'issue') {
        await addDebt({ tgId: worker.tgId, name: worker.name, date, amount: a, note })
        await writeLog({ tgId, name: worker.name, action: 'Debt issued', details: `${date}: ${a} ${cur}${note ? ' — ' + note : ''}` })
      } else {
        await saveDebtPayment({ tgId: worker.tgId, name: worker.name, date, amount: a })
        await writeLog({ tgId, name: worker.name, action: 'Debt payment', details: `${date}: ${a} ${cur}` })
      }
      vibrate('success'); setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 1300)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  if (success) return (
    <Sheet onClose={onClose} title={mode === 'issue' ? t('debtSaved', lang) : t('debtPaymentSaved', lang)}>
      <div style={{ textAlign: 'center', padding: 20, fontSize: 28, fontWeight: 800, color: mode === 'issue' ? C.red : C.green, fontFamily: F }}>{mode === 'issue' ? '+' : '−'}{fmt(amount)} {cur}</div>
    </Sheet>
  )

  return (
    <Sheet onClose={onClose} title={`${mode === 'issue' ? t('issueDebt', lang) : t('payDebt', lang)} — ${worker.name}`}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><Lbl>{t('date', lang)}</Lbl><input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} style={inp} /></div>
        <div><Lbl>{t('amount', lang)}</Lbl><input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" style={inp} /></div>
        {mode === 'issue' && <div><Lbl>{t('bonusNote', lang)}</Lbl><input value={note} onChange={e => setNote(e.target.value)} style={inp} /></div>}
        {error && <div style={{ color: C.red, fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? t('saving', lang) : t('save', lang)}
        </button>
      </form>
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════
// РЕДАГУВАННЯ ЗАПИСУ ДНЯ
// ════════════════════════════════════════════════════════
function EditDayForm({ day, worker, onClose, onSaved, lang }) {
  const [date, setDate] = useState(day.dateShort)
  const [hours, setHours] = useState(day.hours || '')
  const [m2, setM2] = useState(day.m2 || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    try {
      setLoading(true); setError(null)
      await updateShift(day.id, { hours: parseFloat(hours) || 0, m2: parseFloat(m2) || 0, lunchBreak: day.lunchBreak || 0, date })
      vibrate('success')
      onSaved(); onClose()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function del() {
    if (!confirm(t('confirmDelete', lang))) return
    try {
      setLoading(true)
      await deleteShift(day.id)
      vibrate('medium')
      onSaved(); onClose()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Sheet onClose={onClose} title={`${t('edit', lang)} — ${date}`}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><Lbl>{t('date', lang)}</Lbl><input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} style={inp} /></div>
        <div><Lbl>{t('hours', lang)} {day.lunchBreak > 0 ? `(−${day.lunchBreak} ${t('lunchBreakLbl', lang)})` : ''}</Lbl><input type="number" inputMode="decimal" step="0.5" value={hours} onChange={e => setHours(e.target.value)} style={inp} /></div>
        <div><Lbl>{t('m2', lang)}</Lbl><input type="number" inputMode="decimal" step="0.1" value={m2} onChange={e => setM2(e.target.value)} style={inp} /></div>
        {error && <div style={{ color: C.red, fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={del} disabled={loading} style={{ ...dangerBtn, flex: 1 }}>{t('delete', lang)}</button>
          <button type="submit" disabled={loading} style={{ ...primaryBtn, flex: 2 }}>{loading ? t('saving', lang) : t('save', lang)}</button>
        </div>
      </form>
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════
// РЕДАГУВАННЯ ПРОФІЛЮ ПРАЦІВНИКА (імʼя/роль/ID/ставки) + видалення
// ════════════════════════════════════════════════════════
function ProfileEditForm({ worker, onClose, onSaved, onDeleted, lang }) {
  const [name, setName] = useState(worker.name || '')
  const [role, setRole] = useState(worker.role || '')
  const [tgId, setTgId] = useState(worker.tgId || '')
  const [rateHour, setRateHour] = useState(worker.rateHour || '')
  const [rateM2, setRateM2] = useState(worker.rateM2 || '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)

  async function submit(e) {
    e.preventDefault()
    try {
      setLoading(true); setError(null)
      await updateStaffInfo(worker.staffPageId, { name, tgId, role })
      await updateStaffRates(worker.staffPageId, { rateHour, rateM2 })
      vibrate('success'); setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 1000)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function handleDelete() {
    if (!confirmDel) { vibrate('warning'); setConfirmDel(true); return }
    try {
      setLoading(true)
      await deleteStaff(worker.staffPageId)
      vibrate('medium')
      onDeleted(); onClose()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Sheet onClose={onClose} title={t('editProfile', lang)}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><Lbl>{t('workerName', lang)}</Lbl><input value={name} onChange={e => setName(e.target.value)} style={inp} /></div>
        <div><Lbl>{t('role', lang)}</Lbl><input value={role} onChange={e => setRole(e.target.value)} placeholder={t('rolePlaceholder', lang)} style={inp} /></div>
        <div><Lbl>{t('telegramId', lang)}</Lbl><input type="number" value={tgId} onChange={e => setTgId(e.target.value)} style={inp} /></div>
        <div><Lbl>{t('rateHourRow', lang)}</Lbl><input type="number" inputMode="decimal" value={rateHour} onChange={e => setRateHour(e.target.value)} style={inp} /></div>
        <div><Lbl>{t('rateM2Row', lang)}</Lbl><input type="number" inputMode="decimal" value={rateM2} onChange={e => setRateM2(e.target.value)} style={inp} /></div>
        {error && <div style={{ color: C.red, fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ ...primaryBtn, background: success ? C.green : C.blue }}>
          {loading ? t('saving', lang) : success ? t('saved', lang) : t('save', lang)}
        </button>
        <button type="button" onClick={handleDelete} disabled={loading} style={dangerBtn}>
          {confirmDel ? `⚠️ ${t('confirmDeleteWorker', lang)}` : t('deleteWorker', lang)}
        </button>
      </form>
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════
// ФОРМА ДОДАВАННЯ ПРАЦІВНИКА
// ════════════════════════════════════════════════════════
function AddStaffForm({ cfg, onClose, onSaved, lang }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [tgId, setTgId] = useState('')
  const [rateHour, setRateHour] = useState(cfg?.defaultRateHour || '')
  const [rateM2, setRateM2] = useState(cfg?.defaultRateM2 || '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!name || !tgId) { setError(t('workerName', lang) + ' / ' + t('telegramId', lang)); return }
    try {
      setLoading(true); setError(null)
      await addStaff({ tgId, name, role, rateHour, rateM2 })
      vibrate('success'); setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 1100)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  if (success) return (
    <Sheet onClose={onClose} title={t('staffSaved', lang)}>
      <div style={{ textAlign: 'center', padding: 20, fontSize: 18, fontWeight: 800, color: C.green, fontFamily: F }}>{name}</div>
    </Sheet>
  )

  return (
    <Sheet onClose={onClose} title={t('addStaff', lang)}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><Lbl>{t('workerName', lang)}</Lbl><input value={name} onChange={e => setName(e.target.value)} style={inp} /></div>
        <div><Lbl>{t('role', lang)}</Lbl><input value={role} onChange={e => setRole(e.target.value)} placeholder={t('rolePlaceholder', lang)} style={inp} /></div>
        <div><Lbl>{t('telegramId', lang)}</Lbl><input type="number" inputMode="numeric" value={tgId} onChange={e => setTgId(e.target.value)} style={inp} /></div>
        <div><Lbl>{t('rateHourRow', lang)}</Lbl><input type="number" inputMode="decimal" value={rateHour} onChange={e => setRateHour(e.target.value)} style={inp} /></div>
        <div><Lbl>{t('rateM2Row', lang)}</Lbl><input type="number" inputMode="decimal" value={rateM2} onChange={e => setRateM2(e.target.value)} style={inp} /></div>
        {error && <div style={{ color: C.red, fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? t('saving', lang) : t('save', lang)}
        </button>
      </form>
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════
// СТОРІНКА НАЛАШТУВАНЬ
// ════════════════════════════════════════════════════════
function SettingsPage({ cfg, onBack, onSaved, lang, setLang, theme, setTheme, cur }) {
  const [workMode, setWorkMode] = useState(cfg?.workMode || 'mixed')
  const [showHours, setShowHours] = useState(cfg?.showHours ?? true)
  const [showM2, setShowM2] = useState(cfg?.showM2 ?? true)
  const [remindersOn, setRemindersOn] = useState(cfg?.remindersOn ?? true)
  const [lunchBreak, setLunchBreak] = useState(cfg?.lunchBreak ?? 1)
  const [defaultRateHour, setDefaultRateHour] = useState(cfg?.defaultRateHour || 0)
  const [defaultRateM2, setDefaultRateM2] = useState(cfg?.defaultRateM2 || 0)
  const [currency, setCurrency] = useState(cfg?.currency || 'UAH')
  const [editField, setEditField] = useState(null) // 'rateHour' | 'rateM2' | 'lunch' | 'lang' | 'currency'
  const [saving, setSaving] = useState(false)

  async function persist(next) {
    setSaving(true)
    try {
      await saveSettings(cfg?.pageId, {
        workMode: next.workMode ?? workMode,
        showHours: next.showHours ?? showHours,
        showM2: next.showM2 ?? showM2,
        remindersOn: next.remindersOn ?? remindersOn,
        lunchBreak: next.lunchBreak ?? lunchBreak,
        defaultRateHour: next.defaultRateHour ?? defaultRateHour,
        defaultRateM2: next.defaultRateM2 ?? defaultRateM2,
        currency: next.currency ?? currency,
      })
      onSaved()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  function selectMode(m) { setWorkMode(m); vibrate('light'); persist({ workMode: m }) }
  function toggleHours() { const v = !showHours; setShowHours(v); vibrate('light'); persist({ showHours: v }) }
  function toggleM2() { const v = !showM2; setShowM2(v); vibrate('light'); persist({ showM2: v }) }
  function toggleReminders() { const v = !remindersOn; setRemindersOn(v); vibrate('light'); persist({ remindersOn: v }) }

  const lunchH = Math.floor(lunchBreak)
  const lunchM = Math.round((lunchBreak - lunchH) * 60)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 40, fontFamily: F }}>
      <BackHeader title={t('settingsPage', lang)} onBack={onBack} />
      <div style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Режим роботи */}
        <div>
          <Lbl style={{ marginBottom: 10 }}>{t('workModeSection', lang)}</Lbl>
          <Card style={{ padding: '14px 12px' }}>
            <SettingsRow title={t('accountingMode', lang)} value={
              workMode === 'hours' ? t('modeHoursOnly', lang) : workMode === 'm2' ? t('modeM2Only', lang) : t('modeMixed', lang)
            } />
          </Card>
          <div style={{ fontSize: 12, color: C.dim, margin: '10px 4px', lineHeight: 1.5 }}>{t('workModeHint', lang)}</div>
          <Card style={{ padding: '4px 8px' }}>
            <RadioRow icon="🕐" title={t('modeHoursOnly', lang)} desc={t('modeHoursOnlyDesc', lang)} selected={workMode === 'hours'} onClick={() => selectMode('hours')} />
            <RadioRow icon="⬜" title={t('modeM2Only', lang)} desc={t('modeM2OnlyDesc', lang)} selected={workMode === 'm2'} onClick={() => selectMode('m2')} />
            <RadioRow icon="🕐⬜" title={t('modeMixed', lang)} desc={t('modeMixedDesc', lang)} selected={workMode === 'mixed'} onClick={() => selectMode('mixed')} />
          </Card>
        </div>

        {/* Показувати в змінах */}
        <div>
          <Lbl style={{ marginBottom: 10 }}>{t('showInShifts', lang)}</Lbl>
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconCircle bg={C.blueSoft} size={36}>🕐</IconCircle>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{t('showHoursToggle', lang)}</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 1 }}>{t('showHoursDesc', lang)}</div>
              </div>
              <Toggle on={showHours} onClick={toggleHours} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconCircle bg={C.blueSoft} size={36}>⬜</IconCircle>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{t('showM2Toggle', lang)}</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 1 }}>{t('showM2Desc', lang)}</div>
              </div>
              <Toggle on={showM2} onClick={toggleM2} />
            </div>
          </Card>
        </div>

        {/* Налаштування ставок */}
        <div>
          <Lbl style={{ marginBottom: 10 }}>{t('rateSettings', lang)}</Lbl>
          <Card style={{ padding: '4px 12px' }}>
            <div onClick={() => setEditField('rateHour')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${C.border2}`, cursor: 'pointer' }}>
              <IconCircle bg={C.blueSoft} size={34}>🕐</IconCircle>
              <div style={{ flex: 1, fontSize: 15, color: C.text, fontWeight: 500 }}>{t('rateHourRow', lang)}</div>
              <div style={{ fontSize: 14, color: C.dim }}>{fmt(defaultRateHour)} {cur}</div>
              <span style={{ color: C.muted, fontSize: 16 }}>›</span>
            </div>
            <div onClick={() => setEditField('rateM2')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', cursor: 'pointer' }}>
              <IconCircle bg={C.blueSoft} size={34}>⬜</IconCircle>
              <div style={{ flex: 1, fontSize: 15, color: C.text, fontWeight: 500 }}>{t('rateM2Row', lang)}</div>
              <div style={{ fontSize: 14, color: C.dim }}>{fmt(defaultRateM2)} {cur}</div>
              <span style={{ color: C.muted, fontSize: 16 }}>›</span>
            </div>
          </Card>
        </div>

        {/* Обід */}
        <div>
          <Lbl style={{ marginBottom: 10 }}>{t('lunchSection', lang)}</Lbl>
          <Card style={{ padding: '4px 12px' }}>
            <div onClick={() => setEditField('lunch')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', cursor: 'pointer' }}>
              <IconCircle bg={C.blueSoft} size={34}>🍴</IconCircle>
              <div style={{ flex: 1, fontSize: 15, color: C.text, fontWeight: 500 }}>{t('lunchDuration', lang)}</div>
              <div style={{ fontSize: 14, color: C.dim }}>{lunchH} {t('hoursMinShort', lang)} {String(lunchM).padStart(2,'0')} {t('minutesShort', lang)}</div>
              <span style={{ color: C.muted, fontSize: 16 }}>›</span>
            </div>
          </Card>
          <div style={{ fontSize: 12, color: C.dim, margin: '10px 4px', lineHeight: 1.5 }}>{t('lunchHint', lang)}</div>
        </div>

        {/* Інше */}
        <div>
          <Lbl style={{ marginBottom: 10 }}>{t('otherSection', lang)}</Lbl>
          <Card style={{ padding: '4px 12px' }}>
            <div onClick={toggleReminders} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${C.border2}`, cursor: 'pointer' }}>
              <IconCircle bg={C.blueSoft} size={34}>🔔</IconCircle>
              <div style={{ flex: 1, fontSize: 15, color: C.text, fontWeight: 500 }}>{t('remindersRow', lang)}</div>
              <div style={{ fontSize: 14, color: C.dim }}>{remindersOn ? t('enabledLbl', lang) : t('disabledLbl', lang)}</div>
              <span style={{ color: C.muted, fontSize: 16 }}>›</span>
            </div>
            <div onClick={() => setEditField('lang')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${C.border2}`, cursor: 'pointer' }}>
              <IconCircle bg={C.blueSoft} size={34}>🌐</IconCircle>
              <div style={{ flex: 1, fontSize: 15, color: C.text, fontWeight: 500 }}>{t('languageRow', lang)}</div>
              <div style={{ fontSize: 14, color: C.dim }}>{LANGS.find(l => l.code === lang)?.flag} {LANGS.find(l => l.code === lang)?.label}</div>
              <span style={{ color: C.muted, fontSize: 16 }}>›</span>
            </div>
            <div onClick={() => setEditField('currency')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${C.border2}`, cursor: 'pointer' }}>
              <IconCircle bg={C.blueSoft} size={34}>💱</IconCircle>
              <div style={{ flex: 1, fontSize: 15, color: C.text, fontWeight: 500 }}>{t('currencyRow', lang)}</div>
              <div style={{ fontSize: 14, color: C.dim }}>{cur} {currency}</div>
              <span style={{ color: C.muted, fontSize: 16 }}>›</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0' }}>
              <IconCircle bg={C.blueSoft} size={34}>{theme === 'dark' ? '🌙' : '☀️'}</IconCircle>
              <div style={{ flex: 1, fontSize: 15, color: C.text, fontWeight: 500 }}>{t('themeRow', lang)}</div>
              <div style={{ fontSize: 14, color: C.dim }}>{theme === 'dark' ? t('themeDark', lang) : t('themeLight', lang)}</div>
              <Toggle on={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
            </div>
          </Card>
        </div>
      </div>

      {editField === 'rateHour' && (
        <Sheet onClose={() => setEditField(null)} title={t('rateHourRow', lang)}>
          <input type="number" inputMode="decimal" autoFocus defaultValue={defaultRateHour}
            onChange={e => setDefaultRateHour(e.target.value)} style={inp} />
          <button style={{ ...primaryBtn, width: '100%', marginTop: 14 }}
            onClick={() => { persist({ defaultRateHour }); setEditField(null) }}>{t('save', lang)}</button>
        </Sheet>
      )}
      {editField === 'rateM2' && (
        <Sheet onClose={() => setEditField(null)} title={t('rateM2Row', lang)}>
          <input type="number" inputMode="decimal" autoFocus defaultValue={defaultRateM2}
            onChange={e => setDefaultRateM2(e.target.value)} style={inp} />
          <button style={{ ...primaryBtn, width: '100%', marginTop: 14 }}
            onClick={() => { persist({ defaultRateM2 }); setEditField(null) }}>{t('save', lang)}</button>
        </Sheet>
      )}
      {editField === 'lunch' && (
        <Sheet onClose={() => setEditField(null)} title={t('lunchDuration', lang)}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Lbl>{t('hoursMinShort', lang)}</Lbl>
              <input type="number" inputMode="numeric" min="0" defaultValue={lunchH}
                onChange={e => setLunchBreak(Number(e.target.value) + lunchM/60)} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <Lbl>{t('minutesShort', lang)}</Lbl>
              <input type="number" inputMode="numeric" min="0" max="59" defaultValue={lunchM}
                onChange={e => setLunchBreak(lunchH + Number(e.target.value)/60)} style={inp} />
            </div>
          </div>
          <button style={{ ...primaryBtn, width: '100%', marginTop: 14 }}
            onClick={() => { persist({ lunchBreak }); setEditField(null) }}>{t('save', lang)}</button>
        </Sheet>
      )}
      {editField === 'lang' && (
        <Sheet onClose={() => setEditField(null)} title={t('languageRow', lang)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LANGS.map(l => (
              <div key={l.code} onClick={() => { setLang(l.code); setEditField(null) }} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                background: lang === l.code ? C.blueSoft : C.gray,
              }}>
                <span style={{ fontSize: 22 }}>{l.flag}</span>
                <span style={{ fontSize: 15, color: C.text, fontWeight: 600, flex: 1 }}>{l.label}</span>
                {lang === l.code && <span style={{ color: C.blue, fontSize: 16 }}>✓</span>}
              </div>
            ))}
          </div>
        </Sheet>
      )}
      {editField === 'currency' && (
        <Sheet onClose={() => setEditField(null)} title={t('currencyRow', lang)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CURRENCIES.map(c => (
              <div key={c.code} onClick={() => { setCurrency(c.code); persist({ currency: c.code }); setEditField(null) }} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                background: currency === c.code ? C.blueSoft : C.gray,
              }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: C.dim, width: 28 }}>{c.symbol}</span>
                <span style={{ fontSize: 15, color: C.text, fontWeight: 600, flex: 1 }}>{c.label}</span>
                {currency === c.code && <span style={{ color: C.blue, fontSize: 16 }}>✓</span>}
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// РЯДОК ПРАЦІВНИКА (список бригади)
// ════════════════════════════════════════════════════════
function WorkerRow({ w, onClick, cur }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 4px', cursor: 'pointer', borderBottom: `1px solid ${C.border2}` }}>
      <Avatar size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
        {w.role && <div style={{ fontSize: 12.5, color: C.dim, marginTop: 1, fontFamily: F }}>{w.role}</div>}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.blue, fontFamily: F, whiteSpace: 'nowrap' }}>{fmt(w.final)} {cur}</div>
      <span style={{ color: C.muted, fontSize: 16 }}>›</span>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// БЕЙДЖ ДАТИ (число + день тижня + зелена крапка)
// ════════════════════════════════════════════════════════
function DateBadge({ dateShort, lang }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flexShrink: 0 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, marginBottom: 4 }} />
      <div style={{ fontSize: 17, fontWeight: 800, color: C.text, fontFamily: F, lineHeight: 1 }}>{dayNum(dateShort)}</div>
      <div style={{ fontSize: 11, color: C.dim, fontFamily: F, marginTop: 1 }}>{dowShort(dateShort, lang)}</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// РЯДОК ЗМІНИ У СПИСКУ
// ════════════════════════════════════════════════════════
function ShiftRow({ day, rateHour, rateM2, showHours, showM2, workerName, onEdit, lang, cur }) {
  const earned = (day.net||0) * rateHour + (day.m2 || 0) * rateM2
  const isRange = !!day.timeFrom // не зберігається окремо, тож визначаємо по наявності часу — якщо немає, показуємо "Кількість годин"
  return (
    <div style={{ display: 'flex', gap: 12, padding: '13px 4px', borderBottom: `1px solid ${C.border2}`, alignItems: 'flex-start' }}>
      <DateBadge dateShort={day.dateShort} lang={lang} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {workerName && <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3, fontFamily: F }}>{workerName}</div>}
        {showHours && day.net > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.dim, fontFamily: F, marginBottom: 2 }}>
            <span>🕐</span><span>{fmtH(day.net)} {t('hr', lang)}</span>
          </div>
        )}
        {showM2 && day.m2 > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.dim, fontFamily: F }}>
            <span>⬜</span><span>{fmt(day.m2)} {t('m2short', lang)}</span>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }} onClick={() => onEdit?.(day)}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.blue, fontFamily: F, cursor: onEdit ? 'pointer' : 'default' }}>{fmt(earned)} {cur}</div>
        {day.net > 0 && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontFamily: F }}>{fmt(rateHour)}{t('perHourShort', lang)}</div>}
        {day.m2 > 0 && <div style={{ fontSize: 11, color: C.muted, fontFamily: F }}>{fmt(rateM2)}{t('perM2Short', lang)}</div>}
      </div>
    </div>
  )
}

// Список змін працівника за місяць з підсумком
function ShiftsList({ days, rateHour, rateM2, cfg, onEdit, lang, showWorkerNames, allWorkers, cur }) {
  const [sortDesc, setSortDesc] = useState(true)
  if (!days?.length) return <div style={{ textAlign: 'center', color: C.muted, fontSize: 14, padding: 28, fontFamily: F }}>{t('noEntries', lang)}</div>

  const sorted = [...days].sort((a,b) => sortDesc
    ? (b.dateShort||'').localeCompare(a.dateShort||'')
    : (a.dateShort||'').localeCompare(b.dateShort||''))

  const totalHours = days.reduce((s,d)=>s+(d.net||0),0)
  const totalEarn = days.reduce((s,d)=>s+(d.net||0)*rateHour+(d.m2||0)*rateM2,0)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginBottom: 6, padding: '0 4px' }}>
        <button onClick={() => setSortDesc(v => !v)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 13, fontFamily: F, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          {t('sortLbl', lang)} {sortDesc ? '↓' : '↑'}
        </button>
      </div>
      <Card style={{ padding: '0 12px' }}>
        {sorted.map(d => (
          <ShiftRow key={d.id} day={d} rateHour={rateHour} rateM2={rateM2}
            showHours={cfg?.showHours ?? true} showM2={cfg?.showM2 ?? true}
            workerName={showWorkerNames ? d.name : null}
            onEdit={onEdit} lang={lang} cur={cur} />
        ))}
      </Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 6px' }}>
        <div style={{ fontSize: 13, color: C.dim, fontFamily: F }}>{days.length} {t('shiftsCount', lang)} · {fmtH(totalHours)} {t('hr', lang)}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: F }}>{fmt(totalEarn)} {cur}</div>
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════
// ДЕТАЛЬНИЙ ПЕРЕГЛЯД ПРАЦІВНИКА (ВЛАСНИК) — з вкладками
// ════════════════════════════════════════════════════════
function ActionIcon({ icon, label, onClick, bg = C.blueSoft, color = C.blue }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, fontFamily: F }}>
      <div style={{ width: 46, height: 46, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, color }}>{icon}</div>
      <div style={{ fontSize: 10.5, color: C.dim, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'pre-line' }}>{label}</div>
    </button>
  )
}

function WorkerDetail({ w, allWorkers, data, onBack, onRefresh, tgId, tgName, cfg, lang, year, month, onMonthChange, cur }) {
  const [tab, setTab] = useState('shifts')
  const [modal, setModal] = useState(null)
  const [editDay, setEditDay] = useState(null)
  const [showCalc, setShowCalc] = useState(false)

  const monthLabel = `${tMonths(lang)[month].toLowerCase()}`

  const history = [
    ...data.advances.filter(a=>a.tgId===w.tgId).map(x=>({...x, kind:'advance'})),
    ...data.bonuses.filter(b=>b.tgId===w.tgId).map(x=>({...x, kind:'bonus'})),
    ...data.debts.filter(d=>d.tgId===w.tgId && (d.date||'').slice(0,7)===`${year}-${String(month+1).padStart(2,'0')}`).map(x=>({...x, kind:'debtIssued'})),
    ...data.debtPayments.filter(d=>d.tgId===w.tgId).map(x=>({...x, kind:'debtPaid'})),
  ].sort((a,b)=>(b.date||'').localeCompare(a.date||''))

  const tabs = [
    ['profile', t('tabProfile', lang)],
    ['shifts', t('tabShifts', lang)],
    ['accruals', t('tabAccruals', lang)],
    ['history', t('tabHistory', lang)],
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 40, fontFamily: F }}>
      <BackHeader
        onBack={onBack}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar size={40} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>{w.name}<span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, display: 'inline-block' }}/></div>
              {w.role && <div style={{ fontSize: 12, color: C.dim, fontWeight: 500 }}>{w.role}</div>}
            </div>
          </div>
        }
        right={
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setModal('profile')} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
          </div>
        }
      />

      {/* Вкладки */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 12px', gap: 4 }}>
        {tabs.map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '10px 10px 12px',
            fontSize: 13.5, fontWeight: tab===k?700:500, color: tab===k?C.blue:C.dim, fontFamily: F,
            borderBottom: tab===k?`2px solid ${C.blue}`:'2px solid transparent', whiteSpace: 'nowrap',
          }}>{l}</button>
        ))}
      </div>

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <MonthPicker year={year} month={month} onChange={onMonthChange} lang={lang} />

        {tab === 'shifts' && <>
          <HeroCard label={`${t('toPayForMonth', lang)} ${monthLabel}`} amount={`${fmt(w.final)} ${cur}`}>
            <button onClick={() => setShowCalc(true)} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 20, padding: '7px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F, marginTop: 10 }}>
              {t('detailedCalc', lang)} ›
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16, position: 'relative' }}>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', fontFamily: F }}>{t('workedTotal', lang)}</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, fontFamily: F, marginTop: 2 }}>{fmtH(w.totalHours)} {t('hr', lang)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', fontFamily: F }}>{t('byHoursLbl', lang)}</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, fontFamily: F, marginTop: 2 }}>{fmt(w.earnHours)} {cur}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', fontFamily: F }}>{t('byM2Lbl', lang)}</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, fontFamily: F, marginTop: 2 }}>{fmt(w.earnM2)} {cur}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', fontFamily: F }}>{t('rateLbl', lang)}</div>
                <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, fontFamily: F, marginTop: 2 }}>{fmt(w.rateHour)}{t('perHourShort', lang)}</div>
                <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, fontFamily: F }}>{fmt(w.rateM2)}{t('perM2Short', lang)}</div>
              </div>
            </div>
          </HeroCard>

          <div style={{ display: 'flex', gap: 4, background: C.card, borderRadius: 16, padding: '14px 4px', border: `1px solid ${C.border2}` }}>
            <ActionIcon icon="🕐" label={t('actionAddShift', lang)} onClick={() => setModal('shift')} />
            <ActionIcon icon="💵" label={t('actionAdvance', lang)} onClick={() => setModal('advance')} />
            <ActionIcon icon="🎁" label={t('actionBonus', lang)} onClick={() => setModal('bonus')} bg={C.greenSoft} color={C.green} />
            <ActionIcon icon="−" label={t('actionDebt', lang)} onClick={() => setModal('debtIssue')} bg={C.redSoft} color={C.red} />
            <ActionIcon icon="+" label={t('actionDebtPay', lang)} onClick={() => setModal('debtPay')} />
          </div>

          <Lbl>{t('shiftsForMonth', lang)} {monthLabel}</Lbl>
          <ShiftsList days={w.days} rateHour={w.rateHour} rateM2={w.rateM2} cfg={cfg} onEdit={setEditDay} lang={lang} cur={cur} />
        </>}

        {tab === 'profile' && (
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Row label={t('workerName', lang)} value={w.name} />
            <Row label={t('role', lang)} value={w.role || '—'} />
            <Row label={t('telegramId', lang)} value={w.tgId} />
            <Row label={t('rateHourRow', lang)} value={`${fmt(w.rateHour)} ${cur}`} />
            <Row label={t('rateM2Row', lang)} value={`${fmt(w.rateM2)} ${cur}`} last />
          </Card>
        )}

        {tab === 'accruals' && (
          <Card>
            <Lbl>{t('accrualsBreakdown', lang)}</Lbl>
            <Row label={t('byHoursLbl', lang)} value={`${fmt(w.earnHours)} ${cur}`} />
            <Row label={t('byM2Lbl', lang)} value={`${fmt(w.earnM2)} ${cur}`} />
            {w.manualBonus > 0 && <Row label={t('manualBonusLbl', lang)} value={`+${fmt(w.manualBonus)} ${cur}`} color={C.green} />}
            <Row label={t('gross', lang)} value={`${fmt(w.gross)} ${cur}`} bold />
            {w.totalAdv > 0 && <Row label={t('advancesTotal', lang)} value={`−${fmt(w.totalAdv)} ${cur}`} color={C.red} />}
            {w.debtPaidMonth > 0 && <Row label={t('debtPaid', lang)} value={`−${fmt(w.debtPaidMonth)} ${cur}`} color={C.red} />}
            <Row label={t('toPay', lang)} value={`${fmt(w.final)} ${cur}`} color={C.blue} bold last />
            {w.debtRemaining > 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: C.red, background: C.redSoft, borderRadius: 10, padding: '10px 12px' }}>
                {t('debtRemaining', lang)}: {fmt(w.debtRemaining)} {cur}
              </div>
            )}
          </Card>
        )}

        {tab === 'history' && (
          <Card style={{ padding: '4px 14px' }}>
            {history.length === 0 && <div style={{ textAlign: 'center', color: C.muted, padding: 24, fontSize: 14 }}>{t('historyEmpty', lang)}</div>}
            {history.map(h => {
              const cfgByKind = {
                advance:    { icon: '💵', label: t('opAdvance', lang), color: C.red, sign: '−' },
                bonus:      { icon: '🎁', label: t('opBonus', lang), color: C.green, sign: '+' },
                debtIssued: { icon: '📝', label: t('opDebtIssued', lang), color: C.red, sign: '+' },
                debtPaid:   { icon: '💳', label: t('opDebtPaid', lang), color: C.green, sign: '−' },
              }[h.kind]
              return (
                <div key={h.kind+h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border2}` }}>
                  <IconCircle bg={C.gray} size={36}>{cfgByKind.icon}</IconCircle>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{cfgByKind.label}</div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 1 }}>{(h.date||'').slice(0,10).split('-').reverse().join('.')}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: cfgByKind.color }}>{cfgByKind.sign}{fmt(h.amount)} {cur}</div>
                </div>
              )
            })}
          </Card>
        )}
      </div>

      {showCalc && (
        <Sheet onClose={() => setShowCalc(false)} title={t('detailedCalc', lang)}>
          <Row label={t('byHoursLbl', lang)} value={`${fmt(w.earnHours)} ${cur}`} />
          <Row label={t('byM2Lbl', lang)} value={`${fmt(w.earnM2)} ${cur}`} />
          {w.manualBonus > 0 && <Row label={t('manualBonusLbl', lang)} value={`+${fmt(w.manualBonus)} ${cur}`} color={C.green} />}
          <Row label={t('gross', lang)} value={`${fmt(w.gross)} ${cur}`} bold />
          {w.totalAdv > 0 && <Row label={t('advancesTotal', lang)} value={`−${fmt(w.totalAdv)} ${cur}`} color={C.red} />}
          {w.debtPaidMonth > 0 && <Row label={t('debtPaid', lang)} value={`−${fmt(w.debtPaidMonth)} ${cur}`} color={C.red} />}
          <Row label={t('toPay', lang)} value={`${fmt(w.final)} ${cur}`} color={C.blue} bold last />
        </Sheet>
      )}

      {modal === 'shift' && <ShiftForm worker={w} allWorkers={allWorkers} isOwner={true} onClose={() => setModal(null)} onSaved={onRefresh} tgId={tgId} tgName={tgName} cfg={cfg} lang={lang} cur={cur} />}
      {modal === 'advance' && <AdvanceForm worker={w} allWorkers={allWorkers} isOwner={true} onClose={() => setModal(null)} onSaved={onRefresh} tgId={tgId} tgName={tgName} lang={lang} cur={cur} />}
      {modal === 'bonus' && <BonusForm worker={w} onClose={() => setModal(null)} onSaved={onRefresh} tgId={tgId} lang={lang} cur={cur} />}
      {modal === 'debtIssue' && <DebtForm worker={w} mode="issue" onClose={() => setModal(null)} onSaved={onRefresh} tgId={tgId} lang={lang} cur={cur} />}
      {modal === 'debtPay' && <DebtForm worker={w} mode="pay" onClose={() => setModal(null)} onSaved={onRefresh} tgId={tgId} lang={lang} cur={cur} />}
      {modal === 'profile' && <ProfileEditForm worker={w} onClose={() => setModal(null)} onSaved={onRefresh} onDeleted={onBack} lang={lang} />}
      {editDay && <EditDayForm day={editDay} worker={w} onClose={() => setEditDay(null)} onSaved={onRefresh} lang={lang} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// ГОЛОВНА (власник) — hero + бригада
// ════════════════════════════════════════════════════════
function HomeTab({ data, allWorkers, totalFinal, onOpenWorker, onMenu, onAddStaff, lang, setLang, theme, setTheme, cur }) {
  return (
    <div style={{ padding: '0 16px 90px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TopHeader title={t('appName', lang)} onMenu={onMenu} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
      <HeroCard label={t('totalToPayMonth', lang)} amount={`${fmt(totalFinal)} ${cur}`} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: C.text, fontFamily: F }}>{t('staff', lang)}</div>
        <button onClick={onAddStaff} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: C.blue, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15 }}>+</span> {t('addWorkerBtn', lang)}
        </button>
      </div>

      <Card style={{ padding: '0 12px' }}>
        {allWorkers.length === 0 && <div style={{ textAlign: 'center', color: C.muted, padding: 28, fontSize: 14 }}>{t('noWorkers', lang)}</div>}
        {allWorkers.map(w => <WorkerRow key={w.tgId} w={w} onClick={() => onOpenWorker(w.tgId)} cur={cur} />)}
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// БРИГАДА — управління персоналом
// ════════════════════════════════════════════════════════
function TeamTab({ allWorkers, onOpenWorker, onMenu, onAddStaff, lang, setLang, theme, setTheme, cur }) {
  return (
    <div style={{ padding: '0 16px 90px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TopHeader title={t('navTeam', lang)} onMenu={onMenu} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
      <button onClick={onAddStaff} style={{ ...secondaryBtn, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>+</span> {t('addWorkerBtn', lang)}
      </button>
      <Card style={{ padding: '0 12px' }}>
        {allWorkers.length === 0 && <div style={{ textAlign: 'center', color: C.muted, padding: 28, fontSize: 14 }}>{t('noWorkers', lang)}</div>}
        {allWorkers.map(w => <WorkerRow key={w.tgId} w={w} onClick={() => onOpenWorker(w.tgId)} cur={cur} />)}
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// ЗМІНИ — стрічка всіх змін бригади за місяць
// ════════════════════════════════════════════════════════
function ShiftsFeedTab({ data, allWorkers, cfg, year, month, onMonthChange, onMenu, lang, setLang, theme, setTheme, cur }) {
  const rows = data.shifts.map(s => {
    const net = Math.max(0, s.hours - (s.lunchBreak||0))
    return { ...s, net }
  }).sort((a,b)=>(b.dateShort||'').localeCompare(a.dateShort||''))

  return (
    <div style={{ padding: '0 16px 90px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TopHeader title={t('navShifts', lang)} onMenu={onMenu} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
      <MonthPicker year={year} month={month} onChange={onMonthChange} lang={lang} />
      {rows.length === 0 && <div style={{ textAlign: 'center', color: C.muted, padding: 28, fontSize: 14, fontFamily: F }}>{t('noEntries', lang)}</div>}
      {rows.length > 0 && (
        <Card style={{ padding: '0 12px' }}>
          {rows.map(d => {
            const w = allWorkers.find(x => x.tgId === d.tgId)
            return <ShiftRow key={d.id} day={d} rateHour={d.rateHour} rateM2={d.rateM2}
              showHours={cfg?.showHours ?? true} showM2={cfg?.showM2 ?? true}
              workerName={w?.name || d.name} lang={lang} cur={cur} />
          })}
        </Card>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// ЗВІТ — підсумки за місяць
// ════════════════════════════════════════════════════════
function ReportTab({ allWorkers, totalFinal, year, month, onMonthChange, onMenu, lang, setLang, theme, setTheme, cur }) {
  const totalGross = allWorkers.reduce((s,w)=>s+w.gross,0)
  const totalDebt = allWorkers.reduce((s,w)=>s+w.debtRemaining,0)
  const monthLabel = tMonths(lang)[month]

  return (
    <div style={{ padding: '0 16px 90px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TopHeader title={t('navReport', lang)} onMenu={onMenu} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
      <MonthPicker year={year} month={month} onChange={onMonthChange} lang={lang} />

      <Card>
        <div style={{ fontSize: 14, color: C.dim, fontFamily: F, marginBottom: 10 }}>{t('reportTitle', lang)} {monthLabel.toLowerCase()} {year}</div>
        <Row label={t('reportTotalGross', lang)} value={`${fmt(totalGross)} ${cur}`} />
        <Row label={t('reportTotalPaid', lang)} value={`${fmt(totalFinal)} ${cur}`} color={C.blue} bold />
        <Row label={t('reportTotalDebt', lang)} value={totalDebt>0 ? `${fmt(totalDebt)} ${cur}` : '—'} color={totalDebt>0?C.red:C.dim} last />
      </Card>

      <Lbl>{t('reportByWorker', lang)}</Lbl>
      <Card style={{ padding: '0 12px' }}>
        {allWorkers.map(w => (
          <Row key={w.tgId} label={w.name} value={`${fmt(w.final)} ${cur}`} />
        ))}
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// ПРАЦІВНИК — власний кабінет
// ════════════════════════════════════════════════════════
function WorkerHomeTab({ w, cfg, tgId, tgName, year, month, onMonthChange, onRefresh, lang, cur }) {
  const [modal, setModal] = useState(null)
  const [editDay, setEditDay] = useState(null)
  const monthLabel = tMonths(lang)[month].toLowerCase()

  return (
    <div style={{ padding: '0 16px 90px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '14px 0 0', textAlign: 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: C.text, fontFamily: F }}>👋 {w.name}</div>
      </div>
      <MonthPicker year={year} month={month} onChange={onMonthChange} lang={lang} />

      <HeroCard label={`${t('toPayForMonth', lang)} ${monthLabel}`} amount={`${fmt(w.final)} ${cur}`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16, position: 'relative' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)' }}>{t('workedTotal', lang)}</div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, marginTop: 2 }}>{fmtH(w.totalHours)} {t('hr', lang)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)' }}>{t('byHoursLbl', lang)}</div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, marginTop: 2 }}>{fmt(w.earnHours)} {cur}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)' }}>{t('byM2Lbl', lang)}</div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, marginTop: 2 }}>{fmt(w.earnM2)} {cur}</div>
          </div>
        </div>
      </HeroCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button onClick={() => setModal('shift')} style={primaryBtn}>{t('newShift', lang)}</button>
        <button onClick={() => setModal('advance')} style={secondaryBtn}>{t('newAdvance', lang)}</button>
      </div>

      <Lbl>{t('shiftsForMonth', lang)} {monthLabel}</Lbl>
      <ShiftsList days={w.days} rateHour={w.rateHour} rateM2={w.rateM2} cfg={cfg} onEdit={setEditDay} lang={lang} cur={cur} />

      {modal === 'shift' && <ShiftForm worker={w} allWorkers={[w]} isOwner={false} onClose={() => setModal(null)} onSaved={onRefresh} tgId={tgId} tgName={tgName} cfg={cfg} lang={lang} cur={cur} />}
      {modal === 'advance' && <AdvanceForm worker={w} allWorkers={[w]} isOwner={false} onClose={() => setModal(null)} onSaved={onRefresh} tgId={tgId} tgName={tgName} lang={lang} cur={cur} />}
      {editDay && <EditDayForm day={editDay} worker={w} onClose={() => setEditDay(null)} onSaved={onRefresh} lang={lang} />}
    </div>
  )
}

function WorkerReportTab({ w, year, month, onMonthChange, lang, cur }) {
  const monthLabel = tMonths(lang)[month]
  return (
    <div style={{ padding: '0 16px 90px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '14px 0 0', textAlign: 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: C.text, fontFamily: F }}>{t('navReport', lang)}</div>
      </div>
      <MonthPicker year={year} month={month} onChange={onMonthChange} lang={lang} />
      <Card>
        <div style={{ fontSize: 14, color: C.dim, marginBottom: 10 }}>{t('reportTitle', lang)} {monthLabel.toLowerCase()} {year}</div>
        <Row label={t('byHoursLbl', lang)} value={`${fmt(w.earnHours)} ${cur}`} />
        <Row label={t('byM2Lbl', lang)} value={`${fmt(w.earnM2)} ${cur}`} />
        {w.manualBonus > 0 && <Row label={t('manualBonusLbl', lang)} value={`+${fmt(w.manualBonus)} ${cur}`} color={C.green} />}
        <Row label={t('gross', lang)} value={`${fmt(w.gross)} ${cur}`} bold />
        {w.totalAdv > 0 && <Row label={t('advancesTotal', lang)} value={`−${fmt(w.totalAdv)} ${cur}`} color={C.red} />}
        {w.debtPaidMonth > 0 && <Row label={t('debtPaid', lang)} value={`−${fmt(w.debtPaidMonth)} ${cur}`} color={C.red} />}
        <Row label={t('toPay', lang)} value={`${fmt(w.final)} ${cur}`} color={C.blue} bold last />
        {w.debtRemaining > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: C.red, background: C.redSoft, borderRadius: 10, padding: '10px 12px' }}>
            {t('debtRemaining', lang)}: {fmt(w.debtRemaining)} {cur}
          </div>
        )}
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// КОНТЕЙНЕР ВЛАСНИКА (нижнє меню + маршрутизація)
// ════════════════════════════════════════════════════════
function OwnerApp({ data, tgId, tgName, year, month, onMonthChange, onRefresh, lang, setLang, theme, setTheme }) {
  const [navTab, setNavTab] = useState('home')
  const [selWorkerId, setSelWorkerId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [showAddShift, setShowAddShift] = useState(false)

  const cur = curSymbol(data.cfg?.currency)
  const allWorkers = calcAllWorkers(data)
  const totalFinal = allWorkers.reduce((s, w) => s + w.final, 0)

  const navItems = [
    { key: 'home', label: t('navHome', lang), icon: IcoTeam(navTab==='home'?C.blue:C.muted) },
    { key: 'shifts', label: t('navShifts', lang), icon: IcoClock(navTab==='shifts'?C.blue:C.muted) },
    { key: 'add', label: t('navAdd', lang), center: true },
    { key: 'team', label: t('navTeam', lang), icon: IcoTeam(navTab==='team'?C.blue:C.muted) },
    { key: 'report', label: t('navReport', lang), icon: IcoChart(navTab==='report'?C.blue:C.muted) },
  ]

  function handleNav(key) {
    if (key === 'add') {
      if (allWorkers.length === 0) { setShowAddStaff(true); return }
      setShowAddShift(true); return
    }
    setNavTab(key); setSelWorkerId(null)
  }

  if (showSettings) return (
    <SettingsPage cfg={data.cfg} onBack={() => setShowSettings(false)} onSaved={onRefresh} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} cur={cur} />
  )

  if (selWorkerId != null) {
    const w = allWorkers.find(x => x.tgId === selWorkerId)
    if (w) return (
      <>
        <WorkerDetail
          w={w} allWorkers={allWorkers} data={data} onBack={() => setSelWorkerId(null)} onRefresh={onRefresh}
          tgId={tgId} tgName={tgName} cfg={data.cfg} lang={lang}
          year={year} month={month} onMonthChange={onMonthChange} cur={cur}
        />
      </>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {navTab === 'home' && <HomeTab data={data} allWorkers={allWorkers} totalFinal={totalFinal}
        onOpenWorker={setSelWorkerId} onMenu={() => setShowSettings(true)} onAddStaff={() => setShowAddStaff(true)} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} cur={cur} />}
      {navTab === 'shifts' && <ShiftsFeedTab data={data} allWorkers={allWorkers} cfg={data.cfg}
        year={year} month={month} onMonthChange={onMonthChange} onMenu={() => setShowSettings(true)} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} cur={cur} />}
      {navTab === 'team' && <TeamTab allWorkers={allWorkers} onOpenWorker={setSelWorkerId}
        onMenu={() => setShowSettings(true)} onAddStaff={() => setShowAddStaff(true)} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} cur={cur} />}
      {navTab === 'report' && <ReportTab allWorkers={allWorkers} totalFinal={totalFinal}
        year={year} month={month} onMonthChange={onMonthChange} onMenu={() => setShowSettings(true)} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} cur={cur} />}

      <BottomNav items={navItems} active={navTab} onChange={handleNav} />

      {showAddStaff && <AddStaffForm cfg={data.cfg} onClose={() => setShowAddStaff(false)} onSaved={onRefresh} lang={lang} />}
      {showAddShift && <ShiftForm worker={allWorkers[0]} allWorkers={allWorkers} isOwner={true}
        onClose={() => setShowAddShift(false)} onSaved={onRefresh} tgId={tgId} tgName={tgName} cfg={data.cfg} lang={lang} cur={cur} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// КОНТЕЙНЕР ПРАЦІВНИКА (нижнє меню + маршрутизація)
// ════════════════════════════════════════════════════════
function WorkerApp({ data, tgId, tgName, year, month, onMonthChange, onRefresh, lang, setLang, theme, setTheme }) {
  const [navTab, setNavTab] = useState('home')
  const [showAddShift, setShowAddShift] = useState(false)
  const w = calcSalary(tgId, data)
  const cur = curSymbol(data.cfg?.currency)

  const navItems = [
    { key: 'home', label: t('navHome', lang), icon: IcoTeam(navTab==='home'?C.blue:C.muted) },
    { key: 'add', label: t('navAdd', lang), center: true },
    { key: 'report', label: t('navReport', lang), icon: IcoChart(navTab==='report'?C.blue:C.muted) },
  ]

  function handleNav(key) {
    if (key === 'add') { setShowAddShift(true); return }
    setNavTab(key)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ position: 'absolute', top: 14, right: 16, zIndex: 5, display: 'flex', gap: 6 }}>
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <FlagSwitcher lang={lang} setLang={setLang} />
      </div>
      {navTab === 'home' && <WorkerHomeTab w={w} cfg={data.cfg} tgId={tgId} tgName={tgName} year={year} month={month} onMonthChange={onMonthChange} onRefresh={onRefresh} lang={lang} cur={cur} />}
      {navTab === 'report' && <WorkerReportTab w={w} year={year} month={month} onMonthChange={onMonthChange} lang={lang} cur={cur} />}

      <BottomNav items={navItems} active={navTab} onChange={handleNav} />

      {showAddShift && <ShiftForm worker={w} allWorkers={[w]} isOwner={false}
        onClose={() => setShowAddShift(false)} onSaved={onRefresh} tgId={tgId} tgName={tgName} cfg={data.cfg} lang={lang} cur={cur} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// ГОЛОВНИЙ КОМПОНЕНТ
// ════════════════════════════════════════════════════════
export default function App() {
  const [lang, setLang] = useLang()
  const [theme, setTheme] = useTheme()
  const [tgUser] = useState(getTelegramUser)
  const tgId = Number(tgUser.id)
  const tgName = tgUser.name
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true) // тільки для першого завантаження

  // Перше завантаження — блокує екран. Всі наступні (зміна місяця, збереження) —
  // оновлюють дані у фоні, без розмонтування дерева компонентів (щоб не губити навігацію).
  const load = useCallback(async (y, m) => {
    try { setData(await fetchAllData(y ?? year, m ?? month)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [year, month])

  useEffect(() => { load(year, month) }, []) // eslint-disable-line

  function onMonthChange(y, m) { setYear(y); setMonth(m); load(y, m) }
  function onRefresh() { load(year, month) }

  if (loading || !data) return <LoadingScreen lang={lang} />

  const isOwner = OWNER_IDS.includes(tgId)
  const isStaff = data.staff.some(s => s.tgId === tgId)

  if (!isOwner && !isStaff) return <NotRegisteredScreen lang={lang} setLang={setLang} tgId={tgId} />

  if (isOwner) return (
    <OwnerApp data={data} tgId={tgId} tgName={tgName} year={year} month={month} onMonthChange={onMonthChange} onRefresh={onRefresh} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
  )
  return (
    <WorkerApp data={data} tgId={tgId} tgName={tgName} year={year} month={month} onMonthChange={onMonthChange} onRefresh={onRefresh} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
  )
}
