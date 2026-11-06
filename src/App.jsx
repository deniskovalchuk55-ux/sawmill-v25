import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { fetchShared, fetchMonthData, assembleData, EMPTY_MONTH, fetchMonthlyStats,
         calcAllWorkers, calcSalary, saveShift, updateShift, deleteShift, saveBonusRecord, saveFine,
         saveAdvance, saveDebtPayment, addDebt, addStaff, addFixedStaff,
         updateStaffRates, updateFixedSalary, updateStaffInfo, deleteStaff, deleteWorkerCompletely,
         updateStaffToggles, saveSettings, saveSettingChanges, historyEnabled, checkAccess, writeLog, DEFAULT_CFG,
         fetchShipmentRefs, fetchShipmentRows, groupShipments,
         saveShipmentGroup, updateShipmentGroup, deleteShipmentGroup,
         statsByMaterial, statsByFirm, buildShipmentReport,
         addFirm, addMaterial, addSize, deleteRef,
         WOOD_TYPES, fetchSuppliers, addSupplier, deleteSupplier,
         fetchIntake, saveIntake, updateIntake, deleteIntake,
         intakeStatsByWood, intakeStatsBySupplier, buildIntakeReport,
         FUEL_TYPES, FUEL_GRADES, fetchFuel, saveFuel, updateFuel, deleteFuel, fuelStats,
         fetchElectricity, fetchElectricityAll, saveElectricity, updateElectricity, deleteElectricity, calcElectricity } from './notion.js'

const OWNER_IDS = (import.meta.env.VITE_OWNER_IDS||'').split(',').map(x=>Number(x.trim())).filter(Boolean)
const MONTHS_UA = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']
const MONTHS_SHORT = ['Січ','Лют','Бер','Квіт','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру']

// Мотиваційні фрази
const MOTIV = [
  '💪 Кожна година наближає до цілі!',
  '🔥 Ти в ударі цього місяця!',
  '⭐ Продовжуй у тому ж дусі!',
  '🏆 До бонусу рукою подати!',
  '💰 Гроші самі себе не заробляють — але ти заробляєш!',
  '🪵 Пиляй впевнено, заробляй гарно!',
  '🚀 Ще трохи і бонус твій!',
  '💎 Стабільність — ключ до успіху!',
]
const randomMotiv = () => MOTIV[Math.floor(Math.random()*MOTIV.length)]

const GLOBAL_CSS = `
*{-webkit-tap-highlight-color:transparent}
button{transition:transform .14s cubic-bezier(.3,.7,.4,1),background-color .2s,opacity .2s,color .2s;touch-action:manipulation}
button:active:not(:disabled){transform:scale(.965)}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:none}}
@keyframes popIn{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}
@keyframes shimmer{0%{background-position:-240px 0}100%{background-position:calc(240px + 100%) 0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes drawCheck{to{stroke-dashoffset:0}}
@keyframes dotIn{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes spark{0%{transform:translate(0,0) scale(.3);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1);opacity:0}}
@keyframes barGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes barUp{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes navIn{from{transform:translate(-50%,28px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
@keyframes toastIn{from{transform:translate(-50%,12px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
@keyframes prog{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
.view-in{animation:rise .32s cubic-bezier(.2,.8,.2,1) both}
.fade-in{animation:fade .28s ease both}
.sheet-bg{animation:fade .2s ease both}
.sheet{animation:sheetUp .36s cubic-bezier(.2,.9,.25,1.03) both;max-width:520px;margin:0 auto}
.pop{animation:popIn .18s ease-out both;transform-origin:top left}
.stagger>*{animation:rise .38s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*32ms)}
.skel{background-color:rgba(23,23,23,.07);background-image:linear-gradient(90deg,rgba(23,23,23,0) 0,rgba(23,23,23,.07) 50%,rgba(23,23,23,0) 100%);background-size:240px 100%;background-repeat:no-repeat;animation:shimmer 1.3s linear infinite}
.skel-dark{background-color:rgba(255,255,255,.12);background-image:linear-gradient(90deg,rgba(255,255,255,0) 0,rgba(255,255,255,.16) 50%,rgba(255,255,255,0) 100%)}
.spin{animation:spin .8s linear infinite}
.check{stroke-dasharray:24;stroke-dashoffset:24;animation:drawCheck .4s .05s ease-out forwards}
.hero-dot{animation:dotIn .6s cubic-bezier(.2,.9,.3,1.2) both}
.spark{position:absolute;left:-3px;top:-3px;width:7px;height:7px;border-radius:2px;background:#ffd60a;transform:rotate(45deg);animation:spark .7s ease-out forwards}
.bary{transform-box:fill-box;transform-origin:50% 100%;animation:barUp .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*14ms)}
.barx{height:100%;transform-origin:left;animation:barGrow .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*45ms)}
.navbar{animation:navIn .4s .1s cubic-bezier(.2,.9,.25,1) both}
.toast{animation:toastIn .25s ease-out both}
.progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:300;overflow:hidden}
.progress>span{display:block;height:100%;width:35%;background:#ffd60a;border-radius:2px;animation:prog 1s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-delay:0ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`
if (typeof document !== 'undefined' && !document.getElementById('app-css')) {
  const s = document.createElement('style'); s.id = 'app-css'; s.textContent = GLOBAL_CSS; document.head.appendChild(s)
}

// Вібрація через Telegram (impact — дотики, notification — результат)
const vibrate = (type='light') => {
  try {
    const h = window.Telegram?.WebApp?.HapticFeedback
    if (!h) return
    if (type==='success'||type==='error'||type==='warning') h.notificationOccurred(type)
    else if (type==='select') h.selectionChanged()
    else h.impactOccurred(type)
  } catch(e){}
}

const C = {
  bg:'#efeee9',surface:'#ffffff',surface2:'#f6f5f0',
  border:'rgba(23,23,23,0.09)',border2:'rgba(23,23,23,0.05)',
  accent:'#171717',yellow:'#ffd60a',ink:'#171717',gold:'#b7791f',green:'#15803d',
  red:'#e5392f',muted:'#6f6f69',text:'#171717',dim:'#5b5b57',purple:'#6d4fd1',
  w:['#171717','#15803d','#b7791f','#6d4fd1','#e5392f','#0f766e','#2563eb','#be185d'],
}
const IC={clock:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',star:'<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',ban:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',card:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M15 15h2"/>',box:'<path d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10"/>',tree:'<path d="M12 3l6 8h-3l5 7H4l5-7H6z"/><path d="M12 18v3"/>',fuel:'<path d="M5 21V5a2 2 0 012-2h6a2 2 0 012 2v16M5 21h10M15 9h2a2 2 0 012 2v6a1.5 1.5 0 003 0V9l-3-3M8 8h4"/>',bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0012 3z"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',doc:'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/>',home:'<path d="M3 11l9-8 9 8v9H3z"/>',user:'<circle cx="10" cy="8" r="4"/><path d="M3 20c0-4 3-6 7-6M18 14v6M15 17h6"/>',wallet:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M15 15h2"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',refresh:'<path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/>',chev:'<path d="M6 9l6 6 6-6"/>',check:'<path d="M5 12.5l4.5 4.5L19 7"/>',back:'<path d="M15 6l-6 6 6 6"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',plus:'<path d="M12 5v14M5 12h14"/>'}
const stripEmoji = t => typeof t==='string' ? t.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u,'') : t
const Ico = ({n,s=22}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{__html:IC[n]}}/>
const Tile = ({n,label,onClick,primary,danger,wide,i}) =>
  <button onClick={()=>{vibrate('light');onClick&&onClick()}} style={{'--i':i||0,gridColumn:wide?'1 / -1':undefined,background:primary?C.yellow:C.surface,color:danger?C.red:C.ink,border:'none',boxShadow:danger?`inset 0 0 0 2px ${C.red}`:'none',borderRadius:20,padding:wide?'14px 16px':'12px 8px 10px',fontSize:wide?14:12,fontWeight:800,cursor:'pointer',fontFamily:'inherit',lineHeight:1.15,textAlign:wide?'center':'left',display:'flex',flexDirection:wide?'row':'column',justifyContent:wide?'center':'flex-start',alignItems:wide?'center':'flex-start',gap:wide?10:14,minHeight:wide?0:84}}>
    <Ico n={n}/><span>{label}</span>
  </button>
const fmt  = n => Math.round(n||0).toLocaleString('uk-UA')
const plural = (n,one,few,many) => { const a=Math.abs(n)%100, b=a%10; return a>10&&a<20?many:b>1&&b<5?few:b===1?one:many }
const fmtH = n => Number(n||0).toFixed(1)
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const inp = {boxSizing:'border-box',background:'rgba(23,23,23,0.04)',border:`1px solid ${C.border}`,borderRadius:14,color:C.text,padding:'13px 14px',fontSize:15,fontFamily:'inherit',width:'100%',outline:'none',WebkitAppearance:'none'}

// ── UI Primitives ──────────────────────────────────────────
const Card = ({children,top,style={}}) =>
  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:22,padding:'16px 18px',overflowX:'hidden',...style}}>{children}</div>
const Lbl = ({children}) =>
  <div style={{fontSize:12,color:C.muted,marginBottom:4,fontWeight:500}}>{sentence(children)}</div>
const SecTitle = ({children,right}) =>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
    <div style={{fontSize:15,color:C.ink,fontWeight:800}}>{sentence(children)}</div>
    {right}
  </div>
const Row = ({label,value,color=C.text,bold=false,last=false,sub}) =>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:last?'none':`1px solid ${C.border}`,fontSize:13}}>
    <div><span style={{color:C.dim}}>{label}</span>{sub&&<div style={{fontSize:11.5,color:C.muted}}>{sub}</div>}</div>
    <span style={{color,fontWeight:bold?700:400,marginLeft:8,textAlign:'right'}}>{value}</span>
  </div>
const Prog = ({val,max,color}) =>
  <div style={{height:5,borderRadius:3,background:`${color}22`,overflow:'hidden'}}>
    <div style={{height:'100%',width:`${Math.min(100,(val/Math.max(max,1))*100)}%`,background:color,borderRadius:3,transition:'width .4s'}}/>
  </div>

// ── Анімації, скелетони, верхня панель ─────────────────────
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const sentence = ch => {
  const f = s => typeof s === 'string' ? s.charAt(0)+s.slice(1).toLowerCase() : s
  return Array.isArray(ch) ? ch.map((c,i)=>i===0?f(c):(typeof c==='string'?c.toLowerCase():c)) : f(ch)
}

function Num({value, suffix=' ₴', dur=500}) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(()=>{
    const to = Number(value)||0
    if (reducedMotion() || from.current===to) { setShown(to); from.current = to; return }
    const a = from.current, t0 = performance.now()
    let raf
    const tick = t => {
      const p = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-p,3)
      const v = a+(to-a)*e
      from.current = v; setShown(v)
      if (p<1) raf = requestAnimationFrame(tick); else from.current = to
    }
    raf = requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(raf)
  },[value])
  return <>{fmt(shown)}{suffix}</>
}

function Skel({w='100%',h=16,r=10,dark,style}) {
  return <div className={dark?'skel skel-dark':'skel'} style={{width:w,height:h,borderRadius:r,...style}}/>
}

function Chevron({open}) {
  return <span style={{display:'inline-flex',transition:'transform .22s',transform:open?'rotate(180deg)':'none'}}><Ico n="chev" s={18}/></span>
}

function Done({t='Збережено',burst}) {
  return <span style={{display:'inline-flex',alignItems:'center',gap:8,position:'relative'}}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="check" d="M5 12.5l4.5 4.5L19 7"/></svg>
    {t}
    {burst&&<span aria-hidden="true" style={{position:'absolute',left:10,top:10,width:0,height:0}}>
      {Array.from({length:8},(_,k)=>{const a=k/8*Math.PI*2;return <i key={k} className="spark" style={{'--dx':`${Math.cos(a)*34}px`,'--dy':`${Math.sin(a)*34}px`}}/>})}
    </span>}
  </span>
}

function IconBtn({onClick,label,children,spin}) {
  return <button onClick={()=>{vibrate('light');onClick&&onClick()}} aria-label={label} style={{width:40,height:40,borderRadius:'50%',border:'none',background:C.surface,color:C.ink,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,padding:0}}>
    <span className={spin?'spin':''} style={{display:'flex'}}>{children}</span>
  </button>
}

function MonthSwitch({year,month,onChange,count=12}) {
  const [open,setOpen] = useState(false)
  const now = new Date()
  const items = Array.from({length:count},(_,i)=>{ const d = new Date(now.getFullYear(), now.getMonth()-i); return {y:d.getFullYear(), m:d.getMonth()} })
  const label = `${MONTHS_UA[month]}${year!==now.getFullYear()?' '+year:''}`
  return <div style={{position:'relative',flexShrink:0}}>
    <button onClick={()=>{vibrate('light');setOpen(o=>!o)}} aria-haspopup="listbox" aria-expanded={open} style={{display:'flex',alignItems:'center',gap:4,background:C.surface,border:'none',borderRadius:20,padding:'0 12px 0 16px',height:40,fontSize:15,fontWeight:700,color:C.ink,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
      {label}<Chevron open={open}/>
    </button>
    {open&&<>
      <div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:90}}/>
      <div className="pop" role="listbox" style={{position:'absolute',left:0,top:'calc(100% + 8px)',zIndex:91,background:C.surface,borderRadius:22,boxShadow:'0 14px 44px rgba(0,0,0,.2)',padding:6,minWidth:210,maxHeight:'62vh',overflowY:'auto'}}>
        {items.map(({y,m})=>{
          const sel = y===year&&m===month
          return <button key={`${y}-${m}`} role="option" aria-selected={sel} onClick={()=>{setOpen(false);if(!sel){vibrate('light');onChange(y,m)}}} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,border:'none',background:sel?C.yellow:'transparent',borderRadius:16,padding:'0 14px',height:44,fontSize:15,fontWeight:sel?800:600,color:C.ink,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
            <span>{MONTHS_UA[m]} <span style={{color:sel?C.ink:C.muted,fontWeight:500}}>{y}</span></span>
            {sel&&<Ico n="check" s={18}/>}
          </button>
        })}
      </div>
    </>}
  </div>
}

function TopBar({title,year,month,onMonth,onRefresh,onSettings,busy}) {
  return <>
    {busy&&<div className="progress"><span/></div>}
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'12px 16px 4px'}}>
      <div style={{fontSize:21,fontWeight:800,letterSpacing:-.3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0,flexShrink:1}}>{title}</div>
      <MonthSwitch year={year} month={month} onChange={onMonth}/>
      <div style={{marginLeft:'auto',display:'flex',gap:8}}>
        {onSettings&&<IconBtn onClick={onSettings} label="Налаштування"><Ico n="gear" s={20}/></IconBtn>}
        <IconBtn onClick={onRefresh} label="Оновити" spin={busy}><Ico n="refresh" s={20}/></IconBtn>
      </div>
    </div>
  </>
}

function Toast({text}) {
  if (!text) return null
  return <div className="toast" role="status" style={{position:'fixed',left:'50%',bottom:92,background:C.ink,color:'#fff',borderRadius:18,padding:'12px 18px',fontSize:14,fontWeight:600,zIndex:400,maxWidth:'86vw',textAlign:'center',boxShadow:'0 8px 24px rgba(0,0,0,.3)'}}>{text}</div>
}

function AppSkeleton() {
  return <div style={{minHeight:'100vh',background:C.bg,padding:'16px'}}>
    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16}}><Skel w={110} h={26} r={8}/><Skel w={120} h={40} r={20}/></div>
    <Skel h={130} r={28} style={{marginBottom:14}}/>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18}}>{Array.from({length:8},(_,i)=><Skel key={i} h={84} r={20}/>)}</div>
    <PersonSkeleton n={4}/>
  </div>
}

function Sheet({onClose,title,children}) {
  return <div className="sheet-bg" onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(23,23,23,0.55)',display:'flex',alignItems:'flex-end',zIndex:200}}>
    <div className="sheet" onClick={e=>e.stopPropagation()} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'26px 26px 0 0',padding:'20px 20px 44px',width:'100%',maxHeight:'92vh',overflowY:'auto'}}>
      <div style={{width:40,height:4,background:C.muted,borderRadius:2,margin:'0 auto 16px'}}/>
      {title&&<div style={{fontSize:19,fontWeight:800,color:C.ink,marginBottom:18,letterSpacing:-.2}}>{stripEmoji(title)}</div>}
      {children}
    </div>
  </div>
}

function Header({title,sub,onRefresh,onBack,right}) {
  return <div style={{background:C.bg,borderBottom:'none',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10}}>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      {onBack&&<IconBtn onClick={onBack} label="Назад"><Ico n="back" s={20}/></IconBtn>}
      <div>
        <div style={{fontSize:18,fontWeight:800,color:C.ink}}>{stripEmoji(title)}</div>
        {sub&&<div style={{fontSize:11.5,color:C.muted}}>{sub}</div>}
      </div>
    </div>
    <div style={{display:'flex',gap:8,alignItems:'center'}}>
      {right}
      {onRefresh&&<IconBtn onClick={onRefresh} label="Оновити"><Ico n="refresh" s={20}/></IconBtn>}
    </div>
  </div>
}

function Spinner() {
  return <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
    <div style={{fontSize:40}}>🪵</div>
    <style>{`@keyframes sl{0%{transform:translateX(-200%)}100%{transform:translateX(400%)}}`}</style>
    <div style={{color:C.accent,fontSize:12,letterSpacing:3}}>ЗАВАНТАЖЕННЯ...</div>
    <div style={{width:120,height:2,background:C.border,borderRadius:2,overflow:'hidden'}}>
      <div style={{height:'100%',width:'40%',background:C.accent,borderRadius:2,animation:'sl 1s ease-in-out infinite'}}/>
    </div>
  </div>
}

function MonthPicker({year,month,onChange}) {
  return <div style={{display:'flex'}}><MonthSwitch year={year} month={month} onChange={onChange}/></div>
}

// ── Графіки: прості SVG-стовпці з осями, підписами та вибором стовпця ─────
const MONTHS_GEN = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня']
const WD_UA = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб']
const kfmt = v => v>=1000 ? `${+(v/1000).toFixed(1)}к`.replace('.',',') : String(Math.round(v))
const num1 = v => String(+Number(v||0).toFixed(1))
const niceScale = (max, maxTicks=4) => {
  const m = Math.max(max,1), raw = m/maxTicks, pow = Math.pow(10,Math.floor(Math.log10(raw)))
  const step = [1,2,2.5,5,10].map(k=>k*pow).find(x=>x>=raw)
  const top = Math.ceil(m/step-1e-9)*step, ticks = []
  for (let v=0; v<=top+1e-9; v+=step) ticks.push(+v.toFixed(4))
  return {top,ticks}
}

function BarsChart({data,height=176,minTop=0,threshold,thresholdLabel,unit,tickFmt=v=>v,valueFmt=v=>v,detail,hint,legend,label}) {
  const [sel,setSel] = useState(null)
  const W=340, padL=34, padR=6, padT=18, padB=22
  const plotW=W-padL-padR, plotH=height-padT-padB
  const {top,ticks} = niceScale(Math.max(minTop,...data.map(d=>d.v),0))
  const slot = plotW/Math.max(1,data.length)
  const bw = Math.max(4,Math.min(26,slot*.62))
  const y = v => padT+plotH-(v/top)*plotH
  const y0 = padT+plotH
  const labelAll = slot>=20
  const pick = (e,down) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX-r.left)/r.width*W-padL)/slot)
    if (i<0||i>=data.length) return
    if (down&&i===sel) { setSel(null); return }
    if (i!==sel) { vibrate('select'); setSel(i) }
  }
  return <div>
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{display:'block',touchAction:'pan-y',userSelect:'none',WebkitUserSelect:'none'}} role="img" aria-label={label}
      onPointerDown={e=>pick(e,true)} onPointerMove={e=>{ if (e.buttons) pick(e,false) }}>
      {unit&&<text x={padL-6} y={9} textAnchor="end" fontSize="10" fill={C.muted}>{unit}</text>}
      {ticks.map(t=><g key={t}>
        <line x1={padL} x2={W-padR} y1={y(t)} y2={y(t)} stroke={t===0?'rgba(23,23,23,.28)':'rgba(23,23,23,.08)'} strokeWidth="1"/>
        <text x={padL-6} y={y(t)+3.5} textAnchor="end" fontSize="10" fill={C.muted}>{tickFmt(t)}</text>
      </g>)}
      {data.map((d,i)=>d.off&&<rect key={'o'+i} x={padL+i*slot} y={padT} width={slot} height={plotH} fill="rgba(23,23,23,.05)"/>)}
      {sel!==null&&<rect x={padL+sel*slot} y={padT} width={slot} height={plotH} fill="rgba(23,23,23,.09)"/>}
      {threshold!=null&&threshold<=top&&<g>
        <line x1={padL} x2={W-padR} y1={y(threshold)} y2={y(threshold)} stroke={C.ink} strokeOpacity=".6" strokeDasharray="4 3" strokeWidth="1.2"/>
        {thresholdLabel&&<text x={padL+4} y={y(threshold)-4} fontSize="10" fontWeight="700" fill={C.ink} stroke="#fff" strokeWidth="3" paintOrder="stroke">{thresholdLabel}</text>}
      </g>}
      {data.map((d,i)=>{
        if (!(d.v>0)) return null
        const x = padL+i*slot+(slot-bw)/2, yt = y(d.v), h = y0-yt, r = Math.min(3,bw/2,h)
        return <path key={'b'+i} className="bary" style={{'--i':i}} d={`M${x},${y0}V${yt+r}Q${x},${yt} ${x+r},${yt}H${x+bw-r}Q${x+bw},${yt} ${x+bw},${yt+r}V${y0}Z`}
          fill={d.hi?C.yellow:C.ink} stroke={sel===i?C.ink:d.hi?'rgba(23,23,23,.25)':'none'} strokeWidth={sel===i?1.6:1}/>
      })}
      {data.map((d,i)=>d.v>0&&(labelAll||sel===i)&&<text key={'v'+i} x={padL+i*slot+slot/2} y={y(d.v)-4} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.ink}>{valueFmt(d.v)}</text>)}
      {data.map((d,i)=>d.showX!==false&&<text key={'x'+i} x={padL+i*slot+slot/2} y={height-6} textAnchor="middle" fontSize="10" fontWeight={sel===i?800:400} fill={sel===i?C.ink:C.muted}>{d.x}</text>)}
    </svg>
    {detail&&<div key={sel===null?'hint':sel} className="fade-in" style={{marginTop:8,minHeight:44,display:'flex',flexDirection:'column',justifyContent:'center',gap:2,background:'rgba(23,23,23,.05)',borderRadius:14,padding:'9px 12px',fontSize:13,color:sel===null?C.muted:C.ink,fontWeight:sel===null?500:600}}>
      {sel===null?hint:detail(data[sel],sel)}
    </div>}
    {legend&&<div style={{display:'flex',flexWrap:'wrap',gap:'6px 14px',marginTop:10,fontSize:12,color:C.dim}}>
      {legend.map(l=><span key={l.t} style={{display:'inline-flex',alignItems:'center',gap:6}}>
        {l.dash
          ? <span style={{width:16,borderTop:`1.5px dashed ${C.ink}`}}/>
          : <span style={{width:10,height:10,borderRadius:3,background:l.c,boxShadow:l.line?'inset 0 0 0 1px rgba(23,23,23,.2)':'none'}}/>}
        {l.t}
      </span>)}
    </div>}
  </div>
}

function HoursChart({w,year,month,cfg}) {
  const th = w.eLongHours||cfg?.longDayHours||10
  const now = new Date()
  const isCur = year===now.getFullYear()&&month===now.getMonth()
  const byDay = {}
  ;(w.days||[]).forEach(d=>{ byDay[Number(d.date.slice(8,10))] = d })
  const maxDay = Math.max(0,...Object.keys(byDay).map(Number))
  const last = isCur ? Math.max(now.getDate(),maxDay) : new Date(year,month+1,0).getDate()
  const data = Array.from({length:last},(_,i)=>{
    const day = i+1, d = byDay[day], v = d?d.hours:0
    const wd = new Date(year,month,day).getDay()
    return {day,d,v,wd,x:String(day),hi:v>=th,off:wd===0,
      showX: last<=16 || day===1 || day%5===0 || (day===last&&(last%5===0||last%5>=3))}
  })
  return <BarsChart data={data} height={184} minTop={th*1.15} threshold={th} thresholdLabel={`${th} год: бонус`} unit="год"
    valueFmt={num1} label={`Години по днях, ${MONTHS_UA[month]}`}
    hint="Торкнись стовпчика або проведи пальцем по графіку"
    detail={d=><>
      <b style={{fontSize:14}}>{WD_UA[d.wd]}, {d.day} {MONTHS_GEN[month]}</b>
      {d.d
        ? <span style={{fontWeight:500}}>{fmtH(d.d.hours)} год{d.d.packs>0?` · ${d.d.packs} ${plural(d.d.packs,'пачка','пачки','пачок')}`:''}{d.hi?' · довгий день':''}</span>
        : <span style={{fontWeight:500,color:C.muted}}>{d.wd===0?'Вихідний':'Немає запису'}</span>}
    </>}
    legend={[{c:C.ink,t:`до ${th} год`},{c:C.yellow,line:true,t:`${th}+ год`},{c:'rgba(23,23,23,.07)',line:true,t:'неділя'}]}/>
}

const TTip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null
  return <div style={{background:'#ffffff',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',fontSize:12}}>
    <div style={{color:C.accent,marginBottom:4}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{color:p.color||C.text}}>{p.name}: {fmt(p.value)} ₴</div>)}
  </div>
}

function DaysExpand({days,rateHour,ratePack,longDayHours=10,onEdit,isOwner}) {
  const [open,setOpen] = useState(false)
  if (!days?.length) return null
  return <div>
    <button onClick={()=>setOpen(o=>!o)} style={{width:'100%',background:'rgba(23,23,23,0.05)',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',color:C.accent,cursor:'pointer',fontSize:12,fontFamily:'inherit',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span>По днях ({days.length})</span>
      <span>{open?'▲':'▼'}</span>
    </button>
    {open&&<div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
      {days.map(d=>{
        const earn = d.hours*(rateHour||0)+d.packs*(ratePack||0)
        const isLong = d.hours>=longDayHours
        return <div key={d.date} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',fontSize:12}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:C.dim}}>{d.date}{isLong&&<span style={{background:C.yellow,color:C.ink,borderRadius:8,padding:'1px 7px',fontSize:11,fontWeight:800,marginLeft:8}}>{longDayHours}+ год</span>}</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{color:C.green,fontWeight:600}}>{fmt(earn)} ₴</span>
              {isOwner&&onEdit&&<button onClick={()=>onEdit(d)} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.accent,borderRadius:4,padding:'2px 6px',fontSize:11.5,cursor:'pointer',fontFamily:'inherit'}}><Ico n="edit" s={16}/></button>}
            </div>
          </div>
          <div style={{display:'flex',gap:12,fontSize:12,color:C.muted}}>
            {d.hours>0&&<span>{fmtH(d.hours)} год</span>}
            {d.packs>0&&<span>{d.packs} пачок</span>}
          </div>
        </div>
      })}
    </div>}
  </div>
}

// ── Зарплатний листок ──────────────────────────────────────
function PayslipModal({w,month,year,onClose}) {
  const lines = [
    `🪵 ПИЛОРАМА`,
    `━━━━━━━━━━━━━━━`,
    `👤 ${w.name}`,
    `📅 ${MONTHS_UA[month]} ${year}`,
    `━━━━━━━━━━━━━━━`,
    w.type==='shift'?`⏱ Годин: ${fmtH(w.totalHours)} год`:'',
    w.type==='shift'?`📦 Пачок: ${w.totalPacks} шт`:'',
    w.type==='shift'?`📅 Робочих днів: ${w.workDays}`:'',
    `━━━━━━━━━━━━━━━`,
    w.type==='shift'?`💰 Погодинно: ${fmt(w.earnHours)} ₴`:'',
    w.type==='shift'?`📦 Пачки: ${fmt(w.earnPacks)} ₴`:'',
    w.type==='fixed'?`💰 Фікс. ставка: ${fmt(w.gross)} ₴`:'',
    w.bonusLong>0?`⭐ Бонус 10+ год: +${fmt(w.bonusLong)} ₴`:'',
    w.bonusSat>0?`📅 Бонус суботи: +${fmt(w.bonusSat)} ₴`:'',
    w.premium>0?`🏆 Премія: +${fmt(w.premium)} ₴`:'',
    w.manualBonus>0?`🎁 Ручна премія: +${fmt(w.manualBonus)} ₴`:'',
    `━━━━━━━━━━━━━━━`,
    `📊 Нараховано: ${fmt(w.gross)} ₴`,
    w.totalAdv>0?`➖ Аванси: -${fmt(w.totalAdv)} ₴`:'',
    w.totalFines>0?`🚫 Штрафи: -${fmt(w.totalFines)} ₴`:'',
    w.debtPaid>0?`➖ Борг: -${fmt(w.debtPaid)} ₴`:'',
    `━━━━━━━━━━━━━━━`,
    `✅ ДО ВИПЛАТИ: ${fmt(w.final)} ₴`,
  ].filter(Boolean).join('\n')

  return <Sheet onClose={onClose} title="Зарплатний листок">
    <div style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:16,fontFamily:'monospace',fontSize:13,color:C.text,lineHeight:1.8,whiteSpace:'pre-wrap',marginBottom:16}}>
      {lines}
    </div>
    <button onClick={()=>{
      if (navigator.share) navigator.share({text:lines})
      else if (navigator.clipboard) { navigator.clipboard.writeText(lines); vibrate('medium') }
    }} style={{width:'100%',background:C.yellow,color:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
      Скопіювати / Поділитись
    </button>
  </Sheet>
}

// ── Редагування/видалення дня ──────────────────────────────
function EditDayForm({day,worker,onClose,onSaved,tgId,tgName,cfg}) {
  const [hours,   setHours]   = useState(day.hours)
  const [packs,   setPacks]   = useState(day.packs)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const [confirm, setConfirm] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!day.ids?.length) { setError('Немає записів для редагування'); return }
    try {
      setLoading(true); setError(null)
      const h = parseFloat(hours)||0
      const pk = parseFloat(packs)||0
      const rateHour = worker.rateHour||0
      const ratePack = worker.ratePack||0
      // якщо кілька записів за день — видаляємо всі і створюємо один новий
      if (day.ids.length > 1) {
        for (const id of day.ids) await archivePage?.(id) || deleteShift([id])
        await saveShift({ tgId:worker.tgId, name:worker.name, rateHour, ratePack, date:day.date, hours:h, packs:pk, lunchBreak:0 })
      } else {
        await updateShift(day.ids[0], { hours:h, packs:pk, rateHour, ratePack, lunchBreak:0 })
      }
      await writeLog({tgId,name:tgName,action:`Редагування: ${worker.name}`,details:`${day.date}: ${h}год ${pk}пач`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1200)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  async function handleDelete() {
    if (!confirm) { setConfirm(true); return }
    if (!day.ids?.length) return
    try {
      setLoading(true)
      await deleteShift(day.ids)
      await writeLog({tgId,name:tgName,action:`Видалення дня: ${worker.name}`,details:day.date})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},900)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title={`${day.date}`}>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>ГОДИНИ</Lbl>
        <input type="number" inputMode="decimal" step="0.5" value={hours} onChange={e=>setHours(e.target.value)} style={inp}/>
      </div>
      <div><Lbl>ПАЧКИ</Lbl>
        <input type="number" inputMode="numeric" value={packs} onChange={e=>setPacks(e.target.value)} style={inp}/>
      </div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.ink:C.yellow,color:success?C.yellow:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?<Done t="Готово"/>:'Зберегти зміни'}
      </button>
      <button type="button" onClick={handleDelete} disabled={loading||success}
        style={{background:confirm?C.red:'transparent',border:`1px solid ${confirm?C.red:C.red+'55'}`,color:confirm?'#fff':C.red,borderRadius:10,padding:12,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all .2s'}}>
        {confirm?'Підтвердити видалення':'Видалити цей день'}
      </button>
      {confirm&&<div style={{fontSize:12,color:C.muted,textAlign:'center'}}>Натисни ще раз щоб підтвердити</div>}
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА ЗМІНИ
// ================================================================
function ShiftForm({worker,allWorkers,isOwner,onClose,onSaved,tgId,tgName,cfg}) {
  const lb = cfg?.lunchBreak??1
  const [selId,    setSelId]    = useState(worker?.tgId||tgId)
  const [type,     setType]     = useState('hours')
  const [hoursMode,setHoursMode]= useState('range') // 'range' | 'manual'
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo,   setTimeTo]   = useState('')
  const [date,     setDate]     = useState(todayStr())
  const [hours,    setHours]    = useState('')
  const [packs,    setPacks]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState(null)
  const [result,   setResult]   = useState(null)
  const [motiv]                 = useState(randomMotiv())

  const sel = isOwner ? (allWorkers.find(w=>w.tgId===Number(selId))||worker) : worker

  // Парсить будь-який формат часу → десяткове число (7 → 7.0, 7:30 → 7.5, 7.5 → 7.5, 730 → 7.5)
  function parseTime(s) {
    if (!s) return null
    const str = String(s).trim()
    if (str.includes(':')) {
      const [h,m] = str.split(':').map(Number)
      return h + (m||0)/60
    }
    if (str.includes('.')) {
      const [h,m] = str.split('.').map(Number)
      // якщо після крапки < 6 — це десяткова (7.5 = 7год 30хв)
      // якщо >= 6 — це хвилини (7.30 = 7год 30хв)
      if ((m||0) < 6) return parseFloat(str)
      return h + (m||0)/60
    }
    const n = parseFloat(str)
    if (!isNaN(n)) {
      // 700 → 7:00, 730 → 7:30, 7 → 7:00
      if (n >= 100) return Math.floor(n/100) + (n%100)/60
      return n
    }
    return null
  }

  const fromH = parseTime(timeFrom)
  const toH   = parseTime(timeTo)
  const rangeH = (fromH!==null && toH!==null && toH>fromH) ? Math.round((toH-fromH)*10)/10 : null
  const rawH  = hoursMode==='range' ? (rangeH||0) : (parseFloat(hours)||0)
  // Обід віднімається тільки в режимі "З / По". У режимі "Кількість" вводять чисті години.
  const effLb = hoursMode==='range' ? lb : 0
  const actualH = Math.max(0, rawH - effLb)
  const earn = actualH*(sel?.rateHour||0)+(parseFloat(packs)||0)*(sel?.ratePack||0)

  async function submit(e) {
    e.preventDefault()
    const h = type==='packs' ? 0 : rawH
    const pk = type==='hours' ? 0 : parseFloat(packs)||0
    if (!h&&!pk) { setError('Вкажи години або пачки'); return }
    if (hoursMode==='range' && rangeH===null && type!=='packs') { setError('Перевір час початку і кінця'); return }
    try {
      setLoading(true); setError(null)
      await saveShift({tgId:sel.tgId,name:sel.name,rateHour:sel.rateHour||0,ratePack:sel.ratePack||0,date,hours:h,packs:pk,lunchBreak:effLb})
      const detail = hoursMode==='range' && timeFrom && timeTo
        ? `${date}: ${timeFrom}–${timeTo} (${fmtH(h)}год) ${pk?pk+'пач':''}`
        : `${date}: ${h}год ${pk?pk+'пач':''}`
      await writeLog({tgId:isOwner?tgId:sel.tgId,name:sel.name,action:'Зміна',details:detail})
      vibrate('success')
      setResult({hours:h,actualH:Math.max(0,h-effLb),packs:pk,earned:Math.max(0,h-effLb)*(sel.rateHour||0)+pk*(sel.ratePack||0),date,timeFrom,timeTo,lbApplied:effLb})
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},3000)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  if (success&&result) return <Sheet onClose={onClose} title="Зміну внесено!">
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{background:'rgba(34,197,94,0.08)',border:`1px solid rgba(34,197,94,0.2)`,borderRadius:12,padding:16}}>
        <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{result.date}</div>
        {result.hours>0&&<>
          {result.timeFrom&&result.timeTo&&<Row label="Час роботи" value={`${result.timeFrom} – ${result.timeTo}`} color={C.dim}/>}
          <Row label="Введено годин" value={`${fmtH(result.hours)} год`} color={C.dim}/>
          {result.lbApplied>0&&<Row label={`Після обіду (-${result.lbApplied} год)`} value={`${fmtH(result.actualH)} год`} color={C.accent}/>}
        </>}
        {result.packs>0&&<Row label="Пачок" value={`${result.packs} шт`} color={C.gold}/>}
        <Row label="Зароблено" value={`${fmt(result.earned)} ₴`} color={C.green} bold last/>
      </div>
      <div style={{background:'rgba(255,214,10,0.28)',borderRadius:16,padding:'12px 14px',fontSize:13,fontWeight:600,color:C.ink,textAlign:'center'}}>{motiv}</div>
    </div>
  </Sheet>

  return <Sheet onClose={onClose} title="Внести зміну">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      {isOwner&&<div><Lbl>РОБІТНИК</Lbl>
        <select value={selId} onChange={e=>setSelId(e.target.value)} style={{...inp,cursor:'pointer'}}>
          {allWorkers.filter(w=>w.type==='shift').map(w=><option key={w.tgId} value={w.tgId}>{w.name}</option>)}
        </select></div>}

      <div><Lbl>ТИП</Lbl>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          {[['hours','Години'],['packs','Пачки'],['mixed','Змішана']].map(([k,l])=>
            <button key={k} type="button" onClick={()=>setType(k)} style={{padding:'10px 4px',minHeight:42,borderRadius:14,border:'none',background:type===k?C.ink:'rgba(23,23,23,0.06)',color:type===k?C.yellow:C.dim,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:type===k?800:600}}>{l}</button>
          )}
        </div>
      </div>

      <div><Lbl>ДАТА</Lbl>
        <input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} style={inp}/>
      </div>

      {type!=='packs'&&<div>
        {/* Перемикач режиму введення годин */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <Lbl style={{margin:0}}>ГОДИНИ</Lbl>
          <div style={{display:'flex',gap:6}}>
            {[['range','З / По'],['manual','Кількість']].map(([k,l])=>(
              <button key={k} type="button" onClick={()=>setHoursMode(k)}
                style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontFamily:'inherit',cursor:'pointer',border:`1px solid ${hoursMode===k?C.accent:C.border}`,background:hoursMode===k?'rgba(255,214,10,0.28)':'transparent',color:hoursMode===k?C.accent:C.dim}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {hoursMode==='range'
          ? <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11.5,color:C.muted,letterSpacing:1,marginBottom:4}}>З</div>
                <input value={timeFrom} onChange={e=>setTimeFrom(e.target.value)}
                  placeholder="7 або 7:00" style={inp} inputMode="decimal"/>
              </div>
              <div style={{color:C.dim,fontSize:18,paddingTop:18}}>→</div>
              <div style={{flex:1}}>
                <div style={{fontSize:11.5,color:C.muted,letterSpacing:1,marginBottom:4}}>По</div>
                <input value={timeTo} onChange={e=>setTimeTo(e.target.value)}
                  placeholder="17 або 17:00" style={inp} inputMode="decimal"/>
              </div>
            </div>
          : <input type="number" inputMode="decimal" step="0.5" min="0" max="24" value={hours}
              onChange={e=>setHours(e.target.value)} placeholder="напр. 10" style={inp}/>}

        {/* Підказка з розрахунком */}
        {rawH>0&&<div style={{fontSize:12,color:C.accent,marginTop:6,padding:'6px 10px',background:'rgba(23,23,23,0.06)',borderRadius:6}}>
          {hoursMode==='range'
            ? <>{fmtH(rangeH)} год − {lb} год обід = <b>{fmtH(actualH)} год</b> · {fmt(actualH*(sel?.rateHour||0))} ₴</>
            : <><b>{fmtH(actualH)} год</b> · {fmt(actualH*(sel?.rateHour||0))} ₴</>}
        </div>}
      </div>}

      {type!=='hours'&&<div><Lbl>ПАЧКИ</Lbl>
        <input type="number" inputMode="numeric" min="0" value={packs} onChange={e=>setPacks(e.target.value)} placeholder="напр. 12" style={inp}/>
        {packs&&(sel?.ratePack||0)>0&&<div style={{fontSize:12,color:C.gold,marginTop:4}}>= {fmt(parseFloat(packs)*(sel?.ratePack||0))} ₴</div>}
      </div>}

      {earn>0&&<div style={{background:'rgba(34,197,94,0.08)',border:`1px solid rgba(34,197,94,0.2)`,borderRadius:10,padding:'12px 16px',display:'flex',justifyContent:'space-between'}}>
        <span style={{fontSize:12,color:C.dim}}>За зміну</span>
        <span style={{fontSize:18,fontWeight:700,color:C.green}}>{fmt(earn)} ₴</span>
      </div>}
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading} style={{background:C.yellow,color:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit',opacity:loading?.7:1}}>
        {loading?'Збереження...':'Зберегти зміну'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА АВАНСУ
// ================================================================
function AdvanceForm({worker,allWorkers,isOwner,onClose,onSaved,tgId,tgName}) {
  const [selId,   setSelId]   = useState(worker?.tgId||tgId)
  const [date,    setDate]    = useState(todayStr())
  const [amount,  setAmount]  = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const sel = isOwner ? (allWorkers.find(w=>w.tgId===Number(selId))||worker) : worker

  async function submit(e) {
    e.preventDefault()
    if (!amount) return
    try {
      setLoading(true); setError(null)
      await saveAdvance({tgId:sel.tgId,name:sel.name,date,amount:parseFloat(amount)})
      await writeLog({tgId:isOwner?tgId:sel.tgId,name:sel.name,action:'Аванс',details:`${fmt(amount)} ₴`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1400)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title="Аванс">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      {isOwner&&<div><Lbl>РОБІТНИК</Lbl>
        <select value={selId} onChange={e=>setSelId(e.target.value)} style={{...inp,cursor:'pointer'}}>
          {allWorkers.map(w=><option key={w.tgId} value={w.tgId}>{w.name}</option>)}
        </select></div>}
      <div><Lbl>ДАТА</Lbl><input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} style={inp}/></div>
      <div><Lbl>СУМА (грн)</Lbl>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          {[500,1000,2000,3000].map(a=><button key={a} type="button" onClick={()=>{vibrate('light');setAmount(String(a))}} style={{flex:1,minHeight:42,borderRadius:14,border:'none',background:amount===String(a)?C.ink:'rgba(23,23,23,0.06)',color:amount===String(a)?C.yellow:C.dim,fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>{a}</button>)}
        </div>
        <input type="number" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="або введи вручну" style={inp}/>
      </div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.ink:C.yellow,color:success?C.yellow:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?<Done/>:'Видати аванс'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА ШТРАФУ
// ================================================================
function FineForm({worker,allWorkers,onClose,onSaved,tgId,tgName}) {
  const [selId,   setSelId]   = useState(worker?.tgId)
  const [date,    setDate]    = useState(todayStr())
  const [amount,  setAmount]  = useState(0)
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const sel = allWorkers.find(w=>w.tgId===Number(selId))||worker
  const addAmount = (a) => { vibrate('light'); setAmount(prev => (Number(prev)||0) + a) }

  async function submit(e) {
    e.preventDefault()
    if (!amount) return
    try {
      setLoading(true); setError(null)
      await saveFine({tgId:sel.tgId,name:sel.name,date,amount:Number(amount),reason})
      await writeLog({tgId,name:tgName,action:`Штраф: ${sel.name}`,details:`${fmt(amount)} ₴ · ${reason}`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1400)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title="Штраф">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>РОБІТНИК</Lbl>
        <select value={selId} onChange={e=>setSelId(e.target.value)} style={{...inp,cursor:'pointer'}}>
          {allWorkers.map(w=><option key={w.tgId} value={w.tgId}>{w.name}</option>)}
        </select></div>
      <div><Lbl>ДАТА</Lbl><input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} style={inp}/></div>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
          <Lbl>СУМА (натискай — плюсується!)</Lbl>
          {amount>0&&<button type="button" onClick={()=>setAmount(0)} style={{background:'transparent',border:'none',color:C.red,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Скинути</button>}
        </div>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          {[100,200,500,1000].map(a=><button key={a} type="button" onClick={()=>addAmount(a)} style={{flex:1,minHeight:42,borderRadius:14,border:'none',boxShadow:`inset 0 0 0 1.5px ${C.red}`,background:`${C.red}12`,color:C.red,fontSize:14,cursor:'pointer',fontFamily:'inherit',fontWeight:800}}>+{a}</button>)}
        </div>
        <input type="number" inputMode="numeric" value={amount||''} onChange={e=>setAmount(e.target.value)} placeholder="або введи вручну" style={inp}/>
      </div>
      {amount>0&&<div style={{background:`${C.red}11`,border:'none',borderRadius:14,padding:'12px 16px',display:'flex',justifyContent:'space-between'}}>
        <span style={{fontSize:12,color:C.dim}}>{sel?.name}</span>
        <span style={{fontSize:18,fontWeight:700,color:C.red}}>-{fmt(Number(amount))} ₴</span>
      </div>}
      <div><Lbl>ПРИЧИНА</Lbl><input type="text" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Запізнення / прогул / брак" style={inp}/></div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success||!amount} style={{background:success?C.ink:C.red,color:success?C.yellow:'#fff',border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit',opacity:!amount?.5:1}}>
        {loading?'Збереження...':success?<Done/>:'Оштрафувати'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА ПРЕМІЇ (кнопки плюсуються!)
// ================================================================
function BonusForm({worker,allWorkers,onClose,onSaved,tgId,tgName}) {
  const [selId,   setSelId]   = useState(worker?.tgId)
  const [date,    setDate]    = useState(todayStr())
  const [amount,  setAmount]  = useState(0)
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const sel = allWorkers.find(w=>w.tgId===Number(selId))||worker

  // Кнопки ПЛЮСУЮТЬ суму
  const addAmount = (a) => { vibrate('light'); setAmount(prev => (Number(prev)||0) + a) }

  async function submit(e) {
    e.preventDefault()
    if (!amount) return
    try {
      setLoading(true); setError(null)
      await saveBonusRecord({tgId:sel.tgId,name:sel.name,date,amount:Number(amount),reason})
      await writeLog({tgId,name:tgName,action:`Премія: ${sel.name}`,details:`${fmt(amount)} ₴`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1400)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title="Нарахувати премію">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>РОБІТНИК</Lbl>
        <select value={selId} onChange={e=>setSelId(e.target.value)} style={{...inp,cursor:'pointer'}}>
          {allWorkers.map(w=><option key={w.tgId} value={w.tgId}>{w.name}</option>)}
        </select></div>
      <div><Lbl>ДАТА</Lbl><input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} style={inp}/></div>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
          <Lbl>СУМА (натискай — плюсується!)</Lbl>
          {amount>0&&<button type="button" onClick={()=>setAmount(0)} style={{background:'transparent',border:'none',color:C.red,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Скинути</button>}
        </div>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          {[200,300,500,1000].map(a=><button key={a} type="button" onClick={()=>addAmount(a)} style={{flex:1,minHeight:42,borderRadius:14,border:'none',background:C.yellow,color:C.ink,fontSize:14,cursor:'pointer',fontFamily:'inherit',fontWeight:800}}>+{a}</button>)}
        </div>
        <input type="number" inputMode="numeric" value={amount||''} onChange={e=>setAmount(e.target.value)} placeholder="або введи вручну" style={inp}/>
      </div>
      {amount>0&&<div style={{background:'rgba(255,214,10,0.28)',border:'none',borderRadius:14,padding:'12px 16px',display:'flex',justifyContent:'space-between'}}>
        <span style={{fontSize:12,color:C.dim}}>{sel?.name}</span>
        <span style={{fontSize:18,fontWeight:800,color:C.ink}}>+{fmt(Number(amount))} ₴</span>
      </div>}
      <div><Lbl>ПРИЧИНА</Lbl><input type="text" value={reason} onChange={e=>setReason(e.target.value)} placeholder="За перевиконання плану" style={inp}/></div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success||!amount} style={{background:success?C.ink:C.yellow,color:success?C.yellow:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit',opacity:!amount?.5:1}}>
        {loading?'Збереження...':success?<Done burst/>:'Нарахувати'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА ВИПЛАТИ БОРГУ
// ================================================================
function DebtPaymentForm({worker,onClose,onSaved,tgId,tgName}) {
  const [date,    setDate]    = useState(todayStr())
  const [amount,  setAmount]  = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!amount||!worker.debtPageId) return
    try {
      setLoading(true); setError(null)
      const newR = await saveDebtPayment({
        tgId:worker.tgId,name:worker.name,date,amount:parseFloat(amount),
        debtPageId:worker.debtPageId,currentRemaining:worker.debtRemaining,
      })
      await writeLog({tgId,name:tgName,action:`Виплата боргу: ${worker.name}`,details:`${fmt(amount)} ₴, залишок: ${fmt(newR)} ₴`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1400)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title={`Виплата боргу — ${worker.name}`}>
    <div style={{background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:8,padding:'10px 14px',fontSize:13,color:C.red,marginBottom:14}}>
      Залишок боргу: <b>{fmt(worker.debtRemaining)} ₴</b>
    </div>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>ДАТА</Lbl><input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} style={inp}/></div>
      <div><Lbl>СУМА ВИПЛАТИ (грн)</Lbl>
        <input type="number" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`макс. ${fmt(worker.debtRemaining)} ₴`} style={inp}/>
        {amount>0&&<div style={{fontSize:12,color:C.green,marginTop:4}}>Залишок після: {fmt(Math.max(0,worker.debtRemaining-parseFloat(amount)))} грн</div>}
      </div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.ink:C.red,color:success?C.yellow:'#fff',border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?<Done/>:'Внести виплату'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА БОРГУ
// ================================================================
function AddDebtForm({worker,allWorkers,onClose,onSaved,tgId,tgName}) {
  const [selId,   setSelId]   = useState(worker?.tgId)
  const [amount,  setAmount]  = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const sel = allWorkers.find(w=>w.tgId===Number(selId))||worker

  async function submit(e) {
    e.preventDefault()
    if (!amount) return
    try {
      setLoading(true); setError(null)
      await addDebt({tgId:sel.tgId,name:sel.name,amount:parseFloat(amount)})
      await writeLog({tgId,name:tgName,action:`Борг: ${sel.name}`,details:`${fmt(amount)} ₴`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1400)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title="Додати борг">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>РОБІТНИК</Lbl>
        <select value={selId} onChange={e=>setSelId(e.target.value)} style={{...inp,cursor:'pointer'}}>
          {allWorkers.map(w=><option key={w.tgId} value={w.tgId}>{w.name}</option>)}
        </select></div>
      <div><Lbl>СУМА БОРГУ (грн)</Lbl>
        <input type="number" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="напр. 2000" style={inp}/>
        {sel?.debtRemaining>0&&<div style={{fontSize:12,color:C.red,marginTop:4}}>Поточний борг: {fmt(sel.debtRemaining)} ₴ → буде: {fmt((sel.debtRemaining||0)+(parseFloat(amount)||0))} грн</div>}
      </div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.ink:C.red,color:success?C.yellow:'#fff',border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?<Done/>:'Додати борг'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА СТАВОК
// ================================================================
function Toggle({on,onClick,label}) {
  return <div role="switch" aria-checked={!!on} onClick={onClick} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'10px 14px',background:'rgba(23,23,23,0.04)',borderRadius:14,cursor:'pointer',minHeight:50}}>
    <span style={{fontSize:14,fontWeight:600,color:C.text}}>{stripEmoji(label)}</span>
    <div style={{width:50,height:30,borderRadius:15,background:on?C.ink:'rgba(23,23,23,0.18)',position:'relative',transition:'background .2s',flexShrink:0}}>
      <div style={{width:24,height:24,borderRadius:'50%',background:on?C.yellow:'#fff',position:'absolute',top:3,left:on?23:3,transition:'left .22s cubic-bezier(.3,1.4,.5,1),background .2s',boxShadow:'0 1px 3px rgba(0,0,0,.25)'}}/>
    </div>
  </div>
}

function RatesForm({worker,onClose,onSaved,tgId,tgName,cfg,year,month}) {
  const isFixed = worker.type==='fixed'
  const [val,        setVal]        = useState(isFixed?(worker.gross||''):(worker.rateHour||''))
  const [valPack,    setValPack]    = useState(worker.ratePack||'')
  const [bonusOff,   setBonusOff]   = useState(worker.bonusOff||false)
  const [premiumOff, setPremiumOff] = useState(worker.premiumOff||false)
  const [fuelAccess, setFuelAccess] = useState(worker.fuelAccess||false)
  const [lowRateOn,   setLowRateOn]   = useState(worker.lowRateOn||false)
  const [lowRateDays, setLowRateDays] = useState(worker.lowRateDays??19)
  const [rateHourLow, setRateHourLow] = useState(worker.rateHourLow??'')
  const [ratePackLow, setRatePackLow] = useState(worker.ratePackLow??'')
  const wind = worker.ind||{}
  const [ind, setInd] = useState({
    minDaysForBonus: wind.minDaysForBonus ?? '',
    bonusPerLongDay: wind.bonusPerLongDay ?? '',
    bonusSaturday:   wind.bonusSaturday ?? '',
    premiumDays:     wind.premiumDays ?? '',
    premiumAmount:   wind.premiumAmount ?? '',
    longDayHours:    wind.longDayHours ?? '',
    longDaysNeeded:  wind.longDaysNeeded ?? '',
  })
  const [showInd, setShowInd] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [success,    setSuccess]    = useState(false)
  const [error,      setError]      = useState(null)

  const setIndF = (k,v)=>setInd(p=>({...p,[k]:v}))
  const g = cfg||{}

  async function submit(e) {
    e.preventDefault()
    try {
      setLoading(true); setError(null)
      if (historyEnabled()) {
        // Історія: зміни діють з обраного місяця й далі, минулі місяці не чіпаємо
        const nz = v => (v===''||v===null||v===undefined) ? null : Number(v)
        const changes = []
        const add = (param, nv, ov) => { if (nv!==ov) changes.push({param, value:nv, old:ov}) }
        if (isFixed) add('salary', nz(val), nz(worker.gross))
        else {
          add('rateHour', nz(val), nz(worker.rateHourBase ?? worker.rateHour))
          add('ratePack', nz(valPack), nz(worker.ratePackBase ?? worker.ratePack))
          add('bonusOff', !!bonusOff, !!worker.bonusOff)
          add('premiumOff', !!premiumOff, !!worker.premiumOff)
          add('lowRateOn', !!lowRateOn, !!worker.lowRateOn)
          if (lowRateOn) {
            add('lowRateDays', nz(lowRateDays), nz(worker.lowRateDays))
            add('rateHourLow', nz(rateHourLow), nz(worker.rateHourLow))
            add('ratePackLow', nz(ratePackLow), nz(worker.ratePackLow))
          }
          Object.keys(ind).forEach(k => add('ind.'+k, nz(ind[k]), nz((worker.ind||{})[k])))
        }
        await saveSettingChanges(new Date().getFullYear(), new Date().getMonth(), worker.tgId, changes)
        if (!isFixed && fuelAccess !== !!worker.fuelAccess) await updateStaffToggles(worker.staffPageId, {fuelAccess})
      } else if (isFixed) await updateFixedSalary(worker.staffPageId, val)
      else {
        await updateStaffRates(worker.staffPageId, {rateHour:val!==''?val:undefined,ratePack:valPack!==''?valPack:undefined})
        await updateStaffToggles(worker.staffPageId, {bonusOff,premiumOff,fuelAccess,ind,
          lowRateOn, lowRateDays:lowRateDays!==''?lowRateDays:undefined,
          rateHourLow:lowRateOn?(rateHourLow!==''?rateHourLow:null):undefined,
          ratePackLow:lowRateOn?(ratePackLow!==''?ratePackLow:null):undefined})
      }
      await writeLog({tgId,name:tgName,action:`Ставки: ${worker.name}`,details:isFixed?`Фікс: ${val}`:`Год: ${val}, Пач: ${valPack}, Бонуси:${bonusOff?'OFF':'ON'}, Премії:${premiumOff?'OFF':'ON'}`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1200)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  const indFields = [
    ['minDaysForBonus','Мін. днів для бонусів',g.minDaysForBonus],
    ['bonusPerLongDay','Бонус за день 10+ год',g.bonusPerLongDay],
    ['bonusSaturday','Бонус за суботу',g.bonusSaturday],
    ['longDayHours','Годин для довгого дня',g.longDayHours],
    ['longDaysNeeded','Потрібно довгих днів',g.longDaysNeeded],
    ['premiumDays','Днів для премії',g.premiumDays],
    ['premiumAmount','Сума премії',g.premiumAmount],
  ]

  return <Sheet onClose={onClose} title={`Ставки — ${worker.name}`}>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      {isFixed
        ? <div><Lbl>ФІКСОВАНА ЗАРПЛАТА (грн/міс)</Lbl><input type="number" value={val} onChange={e=>setVal(e.target.value)} placeholder={`Зараз: ${worker.gross||'—'}`} style={inp}/></div>
        : <>
          <div><Lbl>СТАВКА ЗА ГОДИНУ (грн)</Lbl><input type="number" value={val} onChange={e=>setVal(e.target.value)} placeholder={`Зараз: ${worker.rateHour||'—'}`} style={inp}/></div>
          <div><Lbl>СТАВКА ЗА ПАЧКУ (грн)</Lbl><input type="number" value={valPack} onChange={e=>setValPack(e.target.value)} placeholder={`Зараз: ${worker.ratePack||'—'}`} style={inp}/></div>
          <div>
            <Lbl>НАРАХУВАННЯ ВИПЛАТ</Lbl>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <Toggle on={!bonusOff}   onClick={()=>{vibrate('light');setBonusOff(v=>!v)}}     label="Бонуси (10+ год, суботи)" color={C.gold}/>
              <Toggle on={!premiumOff} onClick={()=>{vibrate('light');setPremiumOff(v=>!v)}}   label="Премія за місяць" color={C.purple}/>
              <Toggle on={fuelAccess}  onClick={()=>{vibrate('light');setFuelAccess(v=>!v)}}   label="Доступ до внесення палива" color={C.green}/>
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:6}}>Вимкнено — не нараховується навіть якщо умови виконані</div>
          </div>

          {/* Знижена ставка при малій к-сті днів */}
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12}}>
            <Toggle on={lowRateOn} onClick={()=>{vibrate('light');setLowRateOn(v=>!v)}}
              label="Знижена ставка при малих днях" color={C.red}/>
            {lowRateOn&&<div style={{display:'flex',flexDirection:'column',gap:10,marginTop:10}}>
              <div style={{fontSize:12,color:C.muted}}>Якщо робочих днів за місяць менше порогу — застосується знижена ставка на ВЕСЬ місяць</div>
              <div><Lbl>ПОРІГ ДНІВ</Lbl><input type="number" value={lowRateDays} onChange={e=>setLowRateDays(e.target.value)} placeholder="напр. 19" style={inp}/></div>
              <div><Lbl>ЗНИЖЕНА СТАВКА ЗА ГОДИНУ (грн)</Lbl><input type="number" value={rateHourLow} onChange={e=>setRateHourLow(e.target.value)} placeholder={`Звичайна: ${worker.rateHour||'—'}`} style={inp}/></div>
              <div><Lbl>ЗНИЖЕНА СТАВКА ЗА ПАЧКУ (грн)</Lbl><input type="number" value={ratePackLow} onChange={e=>setRatePackLow(e.target.value)} placeholder={`Звичайна: ${worker.ratePack||'—'}`} style={inp}/></div>
            </div>}
          </div>

          {/* Індивідуальні налаштування */}
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12}}>
            <div onClick={()=>setShowInd(v=>!v)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
              <Lbl>ІНДИВІДУАЛЬНІ СУМИ ТА УМОВИ</Lbl>
              <span style={{color:C.accent,fontSize:18,lineHeight:1}}>{showInd?'−':'+'}</span>
            </div>
            <div style={{fontSize:12,color:C.muted,marginBottom:showInd?12:0}}>Порожнє поле = загальне налаштування</div>
            {showInd&&<div style={{display:'flex',flexDirection:'column',gap:10}}>
              {indFields.map(([k,label,def])=>(
                <div key={k}>
                  <Lbl>{label}</Lbl>
                  <input type="number" value={ind[k]} onChange={e=>setIndF(k,e.target.value)}
                    placeholder={`Загальне: ${def ?? '—'}`} style={inp}/>
                </div>
              ))}
            </div>}
          </div>
        </>}
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.ink:C.yellow,color:success?C.yellow:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?<Done/>:'Зберегти'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА РЕДАГУВАННЯ ПРАЦІВНИКА
// ================================================================
function EditWorkerForm({worker,onClose,onSaved,tgId,tgName}) {
  const [name,    setName]    = useState(worker.name||'')
  const [newTgId, setNewTgId] = useState(worker.tgId||'')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const [confirm, setConfirm] = useState(null) // null | 'staffOnly' | 'everything'

  async function submit(e) {
    e.preventDefault()
    try {
      setLoading(true); setError(null)
      if (!worker.staffPageId) {
        // Працівник є у змінах, але немає запису в базі «Персонал» — створюємо
        await addStaff({ tgId:newTgId, name, rateHour:worker.rateHour||0, ratePack:worker.ratePack||0 })
      } else {
        await updateStaffInfo(worker.staffPageId, {name,tgId:newTgId})
      }
      await writeLog({tgId,name:tgName,action:`Редагування: ${worker.name}`,details:`Нове: ${name}`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1200)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  // Видалити тільки запис у «Персонал» (зміни/аванси/премії лишаються в Notion)
  async function handleDeleteStaffOnly() {
    if (!worker.staffPageId) { setError('Немає запису в базі «Персонал» — нема що видаляти цим способом.'); return }
    if (confirm!=='staffOnly') { vibrate('warning'); setConfirm('staffOnly'); return }
    try {
      setLoading(true); setError(null)
      await deleteStaff(worker.staffPageId)
      await writeLog({tgId,name:tgName,action:`Видалення (тільки персонал): ${worker.name}`,details:''})
      onSaved(); onClose()
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  // Повне видалення: усі зміни/аванси/премії/борги ЦЬОГО працівника (за весь час) + запис у «Персонал»
  async function handleDeleteEverything() {
    if (confirm!=='everything') { vibrate('warning'); setConfirm('everything'); return }
    try {
      setLoading(true); setError(null)
      const res = await deleteWorkerCompletely(worker.tgId, worker.staffPageId)
      await writeLog({tgId,name:tgName,action:`Повне видалення: ${worker.name}`,details:`Записів видалено: ${res.deletedRecords}`})
      vibrate('medium')
      onSaved(); onClose()
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title={`Редагувати — ${worker.name}`}>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      {!worker.staffPageId&&<div style={{color:C.gold,fontSize:12,padding:'8px 12px',background:`${C.gold}11`,borderRadius:8}}>
        Цей працівник є у змінах, але ще не доданий у базу «Персонал». При збереженні створимо запис.
      </div>}
      <div><Lbl>ПІБ</Lbl><input type="text" value={name} onChange={e=>setName(e.target.value)} style={inp}/></div>
      <div><Lbl>TELEGRAM ID</Lbl><input type="number" value={newTgId} onChange={e=>setNewTgId(e.target.value)} style={inp}/></div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.ink:C.yellow,color:success?C.yellow:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?<Done/>:'Зберегти'}
      </button>

      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14,display:'flex',flexDirection:'column',gap:8}}>
        <Lbl>ВИДАЛЕННЯ</Lbl>

        <button type="button" onClick={handleDeleteStaffOnly} disabled={loading}
          style={{background:confirm==='staffOnly'?C.red:'transparent',color:confirm==='staffOnly'?'#fff':C.red,border:`1px solid ${C.red}`,borderRadius:10,padding:12,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>
          {confirm==='staffOnly'?'Підтвердити — видалити тільки картку':'Видалити тільки з «Персонал»'}
        </button>
        <div style={{fontSize:12,color:C.muted,marginTop:-4}}>Зміни, аванси, премії — лишаться в Notion. Працівник зникне зі списку тільки якщо немає змін у поточному місяці.</div>

        <button type="button" onClick={handleDeleteEverything} disabled={loading}
          style={{background:confirm==='everything'?C.red:'transparent',color:confirm==='everything'?'#fff':C.red,border:`1px solid ${C.red}`,borderRadius:10,padding:12,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700,marginTop:4}}>
          {confirm==='everything'?'Підтвердити — видалити ВСЕ назавжди':'Видалити повністю (зі змінами)'}
        </button>
        <div style={{fontSize:12,color:C.muted,marginTop:-4}}>Видалить картку «Персонал» + усі його зміни, аванси, премії, борги за весь час. Інших працівників не торкає. Незворотно.</div>
      </div>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА ДОДАВАННЯ ПРАЦІВНИКА
// ================================================================
function AddWorkerForm({onClose,onSaved,tgId,tgName}) {
  const [type,    setType]    = useState('shift')
  const [name,    setName]    = useState('')
  const [newTgId, setNewTgId] = useState('')
  const [rateH,   setRateH]   = useState('')
  const [rateP,   setRateP]   = useState('')
  const [salary,  setSalary]  = useState('')
  const [role,    setRole]    = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!name||!newTgId) return
    try {
      setLoading(true); setError(null)
      if (type==='shift') await addStaff({tgId:Number(newTgId),name,rateHour:parseFloat(rateH)||0,ratePack:parseFloat(rateP)||0})
      else await addFixedStaff({tgId:Number(newTgId),name,salary:parseFloat(salary)||0,role})
      await writeLog({tgId,name:tgName,action:`Додано: ${name}`,details:`ID: ${newTgId}`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1400)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title="+ Додати працівника">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>ТИП</Lbl>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[['shift','Погодинний'],['fixed','Фіксована']].map(([k,l])=>
            <button key={k} type="button" onClick={()=>setType(k)} style={{padding:'10px',minHeight:42,borderRadius:14,border:'none',background:type===k?C.ink:'rgba(23,23,23,0.06)',color:type===k?C.yellow:C.dim,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:type===k?800:600}}>{l}</button>
          )}
        </div></div>
      <div><Lbl>ПІБ</Lbl><input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Іван Петренко" style={inp}/></div>
      <div><Lbl>TELEGRAM ID</Lbl>
        <input type="number" value={newTgId} onChange={e=>setNewTgId(e.target.value)} placeholder="123456789" style={inp}/>
        <div style={{fontSize:11.5,color:C.muted,marginTop:4}}>Дізнатись у @userinfobot</div>
      </div>
      {type==='shift'&&<>
        <div><Lbl>СТАВКА/ГОД (грн)</Lbl><input type="number" value={rateH} onChange={e=>setRateH(e.target.value)} placeholder="85" style={inp}/></div>
        <div><Lbl>СТАВКА/ПАЧКУ (грн)</Lbl><input type="number" value={rateP} onChange={e=>setRateP(e.target.value)} placeholder="140" style={inp}/></div>
      </>}
      {type==='fixed'&&<>
        <div><Lbl>ЗАРПЛАТА/МІС (грн)</Lbl><input type="number" value={salary} onChange={e=>setSalary(e.target.value)} placeholder="15000" style={inp}/></div>
        <div><Lbl>ПОСАДА</Lbl><input type="text" value={role} onChange={e=>setRole(e.target.value)} placeholder="Бухгалтер" style={inp}/></div>
      </>}
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.ink:C.yellow,color:success?C.yellow:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?<Done t="Додано"/>:'Додати працівника'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА НАЛАШТУВАНЬ
// ================================================================
function SettingsForm({cfg,onClose,onSaved,tgId,tgName,year,month}) {
  const [form,    setForm]    = useState({...cfg})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const set = (k,v) => setForm(f=>({...f,[k]:Number(v)}))

  async function submit(e) {
    e.preventDefault()
    try {
      setLoading(true); setError(null)
      if (historyEnabled()) {
        const keys = ['minDaysForBonus','bonusPerLongDay','bonusSaturday','premiumDays','premiumAmount','longDayHours','longDaysNeeded']
        const changes = keys.filter(k=>Number(form[k])!==Number(cfg[k])).map(k=>({param:'cfg.'+k,value:Number(form[k]),old:Number(cfg[k])}))
        await saveSettingChanges(new Date().getFullYear(), new Date().getMonth(), null, changes)
        await saveSettings(cfg.pageId, form, ['lunchBreak','electricityTariff'])
      } else await saveSettings(cfg.pageId, form)
      await writeLog({tgId,name:tgName,action:'Налаштування',details:JSON.stringify(form)})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1200)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  const fields = [
    {k:'minDaysForBonus', l:'Мін. днів для бонусів'},
    {k:'longDayHours',    l:'Годин для "довгого дня"'},
    {k:'longDaysNeeded',  l:'Потрібно довгих днів'},
    {k:'bonusPerLongDay', l:'Бонус за довгий день (грн)'},
    {k:'bonusSaturday',   l:'Бонус за суботу (грн)'},
    {k:'premiumDays',     l:'Днів для премії'},
    {k:'premiumAmount',   l:'Сума премії (грн)'},
    {k:'lunchBreak',           l:'Обід (год)'},
    {k:'electricityTariff',    l:'Тариф електрики (грн/кВт·год)'},
  ]

  return <Sheet onClose={onClose} title="Налаштування">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:12}}>
      {fields.map(f=><div key={f.k}><Lbl>{f.l}</Lbl><input type="number" step="0.5" value={form[f.k]??''} onChange={e=>set(f.k,e.target.value)} style={inp}/></div>)}
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.ink:C.yellow,color:success?C.yellow:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit',marginTop:4}}>
        {loading?'Збереження...':success?<Done/>:'Зберегти'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// РОЗДІЛ БОРГІВ (для власника)
// ================================================================
function FinesView({workers,onBack,onRefresh,tgId,tgName,month,year}) {
  const [modal,setModal]=useState(false)
  const fined = workers.filter(w=>(w.totalFines||0)>0)
  const total = fined.reduce((s,w)=>s+w.totalFines,0)
  return <div className="view-in" style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title="Штрафи" sub={`${MONTHS_UA[month]} ${year}`} onBack={onBack}/>
    <div style={{padding:'8px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <div style={{background:C.ink,borderRadius:26,padding:'20px 22px',color:'#fff'}}>
        <div style={{fontSize:12,letterSpacing:2,opacity:.6,textTransform:'uppercase'}}>Штрафів за місяць</div>
        <div style={{fontSize:30,fontWeight:800,marginTop:4}}>{fmt(total)} ₴</div>
        <div style={{fontSize:12,opacity:.6,marginTop:2}}>{fined.length} працівників</div>
      </div>
      {fined.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>Цього місяця штрафів немає</div>}
      {fined.map(w=><div key={w.tgId} style={{background:C.surface,border:`2px solid ${C.red}`,borderRadius:20,padding:'14px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:14,marginBottom:6}}>
          <span>{w.name}</span><span style={{color:C.red}}>−{fmt(w.totalFines)} ₴</span>
        </div>
        {(w.fines||[]).map((f,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:12,color:C.dim,padding:'3px 0'}}>
          <span>{f.date?.slice(5).split('-').reverse().join('.')} · {f.reason||'без причини'}</span><span>{fmt(f.amount)} ₴</span>
        </div>)}
      </div>)}
      <button onClick={()=>setModal(true)} style={{background:C.red,color:'#fff',border:'none',borderRadius:16,padding:14,fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>Оштрафувати</button>
    </div>
    {modal&&<FineForm worker={workers[0]||{}} allWorkers={workers} onClose={()=>setModal(false)} onSaved={()=>{onRefresh()}} tgId={tgId} tgName={tgName}/>}
  </div>
}

function DebtsView({workers,onBack,onRefresh,tgId,tgName}) {
  const [modal,  setModal]  = useState(null)
  const [selW,   setSelW]   = useState(null)
  const debtors = workers.filter(w=>w.debtRemaining>0)
  const totalDebt = debtors.reduce((s,w)=>s+w.debtRemaining,0)

  return <div className="view-in" style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title="Борги" onBack={onBack}/>
    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <Card top={C.red}>
        <Lbl>Загальний борг</Lbl>
        <div style={{fontSize:22,fontWeight:700,color:C.red}}>{fmt(totalDebt)} ₴</div>
        <div style={{fontSize:12,color:C.muted,marginTop:4}}>{debtors.length} боржників</div>
      </Card>

      {debtors.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>Боргів немає!</div>}

      {debtors.map((w,i)=>(
        <Card key={w.tgId}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
            <span style={{color:C.w[i%C.w.length],fontWeight:600,fontSize:14}}>{w.name}</span>
            <span style={{color:C.red,fontWeight:700,fontSize:14}}>{fmt(w.debtRemaining)} ₴</span>
          </div>
          <Prog val={w.debtRemaining} max={w.debtRemaining+(w.debtPaid||0)} color={C.red}/>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:12,color:C.muted}}>
            <span>Погашено: {fmt(w.debtPaid||0)} ₴</span>
            <span>{w.debtPaid>0?`${Math.round(w.debtPaid/(w.debtRemaining+w.debtPaid)*100)}%`:'0%'} погашено</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
            <button onClick={()=>{setSelW(w);setModal('debtpay')}} style={{background:`${C.red}11`,border:`1px solid ${C.red}`,color:C.red,borderRadius:8,padding:'8px',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>Виплата</button>
            <button onClick={()=>{setSelW(w);setModal('adddebt')}} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.dim,borderRadius:8,padding:'8px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>+ Додати борг</button>
          </div>
        </Card>
      ))}

      <button onClick={()=>{setSelW(workers[0]);setModal('adddebt')}} style={{background:'rgba(241,71,71,0.1)',border:`1px solid ${C.red}`,color:C.red,borderRadius:10,padding:12,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>
        + Новий борг
      </button>
    </div>

    {modal==='debtpay'&&selW&&<DebtPaymentForm worker={selW} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='adddebt'&&<AddDebtForm worker={selW||workers[0]} allWorkers={workers} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
  </div>
}

// ================================================================
// ПОЛЕ ВИБОРУ З ВПИСУВАННЯМ (datalist — вибір зі списку АБО ввід нового)
// ================================================================
function ComboField({label,value,onChange,options,placeholder}) {
  const listId = 'dl-'+label.replace(/\s/g,'')
  return <div>
    <Lbl>{label}</Lbl>
    <input list={listId} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder||'оберіть або впишіть'} style={inp}/>
    <datalist id={listId}>
      {options.map(o=><option key={o.id||o.name} value={o.name}/>)}
    </datalist>
  </div>
}

// ================================================================
// ФОРМА ВІДПРАВКИ — кілька позицій
// ================================================================
function ShipmentForm({refs,editGroup,onClose,onSaved,onRefsChanged,tgId,tgName}) {
  const isEdit = !!editGroup
  const [firm,      setFirm]      = useState(editGroup?.firm||'')
  const [dateShort, setDateShort] = useState(editGroup?.dateShort||todayStr())
  const [positions, setPositions] = useState(
    editGroup?.positions?.length
      ? editGroup.positions.map(p=>({material:p.material||'',size:p.size||'',qty:String(p.qty||'')}))
      : [{material:'',size:'',qty:''}]
  )
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState(null)

  function setPos(i,field,val) {
    setPositions(prev=>prev.map((p,idx)=>idx===i?{...p,[field]:val}:p))
  }
  function addPos()  { setPositions(prev=>[...prev,{material:'',size:'',qty:''}]) }
  function delPos(i) { setPositions(prev=>prev.filter((_,idx)=>idx!==i)) }

  async function submit(e) {
    e.preventDefault()
    if (!firm.trim()) { setError('Вкажи фірму'); return }
    const clean = positions
      .filter(p=>p.material.trim()&&p.qty)
      .map(p=>({material:p.material.trim(),size:p.size.trim(),qty:Number(p.qty)||0}))
    if (!clean.length) { setError('Додай хоча б одну позицію (вид + кількість)'); return }
    try {
      setLoading(true); setError(null)
      // нові фірми/види/розміри — у довідники
      const known = {
        f: refs.firms.map(x=>x.name),
        m: refs.materials.map(x=>x.name),
        s: refs.sizes.map(x=>x.name),
      }
      if (firm.trim() && !known.f.includes(firm.trim())) await addFirm(firm.trim())
      for (const p of clean) {
        if (p.material && !known.m.includes(p.material)) { await addMaterial(p.material); known.m.push(p.material) }
        if (p.size && !known.s.includes(p.size))         { await addSize(p.size);         known.s.push(p.size) }
      }
      if (isEdit) {
        await updateShipmentGroup({ oldRowIds:editGroup.rowIds, firm:firm.trim(), date:editGroup.date, positions:clean })
        await writeLog({tgId,name:tgName,action:'Редаг. відправку',details:`${firm}: ${clean.length} поз.`})
      } else {
        await saveShipmentGroup({ firm:firm.trim(), dateShort, positions:clean })
        await writeLog({tgId,name:tgName,action:'Відправка',details:`${firm}: ${clean.length} поз.`})
      }
      await onRefsChanged()
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1100)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title={isEdit?'Редагувати відправку':'Нова відправка'}>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <ComboField label="ФІРМА" value={firm} onChange={setFirm} options={refs.firms} placeholder="оберіть або впишіть фірму"/>
      <div><Lbl>ДАТА</Lbl>
        <input type="date" value={dateShort} max={todayStr()} disabled={isEdit}
          onChange={e=>setDateShort(e.target.value)} style={{...inp,opacity:isEdit?0.6:1}}/>
      </div>

      <div style={{height:1,background:C.border}}/>
      <Lbl>ПОЗИЦІЇ ({positions.length})</Lbl>

      {positions.map((pos,i)=>(
        <div key={i} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:12,display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,color:C.accent,fontWeight:700}}>Позиція {i+1}</span>
            {positions.length>1&&<button type="button" onClick={()=>delPos(i)} style={{background:'transparent',border:'none',color:C.red,fontSize:16,cursor:'pointer',fontFamily:'inherit',lineHeight:1}}>✕</button>}
          </div>
          <ComboField label="ВИД" value={pos.material} onChange={v=>setPos(i,'material',v)} options={refs.materials} placeholder="напр. Палети"/>
          <ComboField label="РОЗМІР (необовʼязково)" value={pos.size} onChange={v=>setPos(i,'size',v)} options={refs.sizes} placeholder="напр. 1200×1200"/>
          <div><Lbl>КІЛЬКІСТЬ</Lbl>
            <input type="number" inputMode="numeric" value={pos.qty} onChange={e=>setPos(i,'qty',e.target.value)} placeholder="напр. 15" style={inp}/>
          </div>
        </div>
      ))}

      <button type="button" onClick={addPos} style={{background:'transparent',border:`1px dashed ${C.accent}`,color:C.accent,borderRadius:10,padding:11,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
        + Додати позицію
      </button>

      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.ink:C.yellow,color:success?C.yellow:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?<Done/>:isEdit?'Зберегти зміни':'Зберегти відправку'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// КЕРУВАННЯ ДОВІДНИКАМИ (фірми / види / розміри)
// ================================================================
function RefsManager({refs,onClose,onChanged}) {
  const [tab,    setTab]    = useState('firms')
  const [newVal, setNewVal] = useState('')
  const [busy,   setBusy]   = useState(false)

  const cfg = {
    firms:     {title:'Фірми',         list:refs.firms,     add:addFirm},
    materials: {title:'Види сировини', list:refs.materials, add:addMaterial},
    sizes:     {title:'Розміри',       list:refs.sizes,     add:addSize},
  }
  const cur = cfg[tab]

  async function handleAdd() {
    if (!newVal.trim()||busy) return
    try { setBusy(true); await cur.add(newVal.trim()); setNewVal(''); await onChanged(); vibrate('light') }
    catch(e){ alert('Помилка: '+e.message) } finally{ setBusy(false) }
  }
  async function handleDel(item) {
    if (!confirm(`Видалити «${item.name}»?\n\nСтарі відправки залишаться недоторкані.`)) return
    try { setBusy(true); await deleteRef(item.id); await onChanged(); vibrate('medium') }
    catch(e){ alert('Помилка: '+e.message) } finally{ setBusy(false) }
  }

  return <Sheet onClose={onClose} title="Довідники">
    <div style={{display:'flex',gap:6,marginBottom:14}}>
      {Object.entries(cfg).map(([k,v])=>(
        <button key={k} onClick={()=>{setTab(k);setNewVal('')}} style={{flex:1,padding:'8px 4px',minHeight:42,borderRadius:14,border:'none',background:tab===k?C.ink:'rgba(23,23,23,0.06)',color:tab===k?C.yellow:C.dim,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:tab===k?800:600}}>{v.title}</button>
      ))}
    </div>

    <div style={{display:'flex',gap:6,marginBottom:14}}>
      <input value={newVal} onChange={e=>setNewVal(e.target.value)} placeholder={`Нова назва...`} style={{...inp,fontSize:13}}/>
      <button onClick={handleAdd} disabled={busy} style={{background:C.green,border:'none',color:'#fff',borderRadius:8,padding:'0 16px',fontSize:18,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>+</button>
    </div>

    <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:'50vh',overflowY:'auto'}}>
      {cur.list.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:13,padding:20}}>Список порожній</div>}
      {cur.list.map(item=>(
        <div key={item.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px'}}>
          <span style={{fontSize:14,color:C.text}}>{item.name}</span>
          <button onClick={()=>handleDel(item)} disabled={busy} style={{background:'transparent',border:`1px solid ${C.red}33`,color:C.red,borderRadius:6,padding:'4px 10px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Видалити</button>
        </div>
      ))}
    </div>
  </Sheet>
}

// ================================================================
// БЛОК СТАТИСТИКИ МАТЕРІАЛУ (компактний рядок + розміри під ним)
// ================================================================
function MatStatRow({name,data,accent}) {
  return <div style={{padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
      <span style={{fontSize:14,fontWeight:700,color:accent||C.text}}>{name}</span>
      <span style={{fontSize:14,fontWeight:700,color:accent||C.text}}>{fmt(data.total)}</span>
    </div>
    {data.hasSizes&&Object.entries(data.sizes).sort((a,b)=>b[1]-a[1]).map(([sz,q])=>(
      <div key={sz} style={{display:'flex',justifyContent:'space-between',paddingLeft:14,marginTop:3}}>
        <span style={{fontSize:12,color:C.dim}}>{sz}</span>
        <span style={{fontSize:12,color:C.dim}}>{fmt(q)}</span>
      </div>
    ))}
  </div>
}

// ================================================================
// РОЗДІЛ ВІДПРАВОК
// ================================================================
function ShipmentsView({onBack,tgId,tgName,year,month,onMonthChange}) {
  const [refs,    setRefs]    = useState({firms:[],materials:[],sizes:[]})
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)   // 'new' | 'refs' | {edit:group}
  const [tab,     setTab]     = useState('stats') // stats | list
  const [statTab, setStatTab] = useState('mat')   // mat | firm
  const [firmFilter, setFirmFilter] = useState('')
  const [report,  setReport]  = useState(null)

  const loadRefs = useCallback(async()=>{
    try { setRefs(await fetchShipmentRefs()) } catch(e){}
  },[])
  const loadRows = useCallback(async(y,m)=>{
    try { setLoading(true); setRows(await fetchShipmentRows(y??year,m??month)) }
    catch(e){} finally{ setLoading(false) }
  },[year,month])

  useEffect(()=>{ loadRefs(); loadRows() },[])

  const groups   = groupShipments(rows)
  const matStats = statsByMaterial(rows)
  const firmStats= statsByFirm(rows)
  const totalAll = rows.reduce((s,r)=>s+r.qty,0)
  const firmNames= Object.keys(firmStats).sort((a,b)=>a.localeCompare(b,'uk'))

  const shownGroups = firmFilter ? groups.filter(g=>g.firm===firmFilter) : groups

  async function handleDeleteGroup(g) {
    if (!confirm(`Видалити відправку?\n\n${g.firm} — ${g.dateShort.split('-').reverse().join('.')}\n${g.positions.length} поз.`)) return
    try { await deleteShipmentGroup(g.rowIds); vibrate('medium'); loadRows() }
    catch(e){ alert(e.message) }
  }
  function doExport() {
    setReport(buildShipmentReport(groups,14))
  }

  return <div className="view-in" style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title="Відправки" sub={`${MONTHS_UA[month]} ${year}`} onBack={onBack}
      right={<button onClick={()=>setModal('refs')} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.purple,borderRadius:8,padding:'6px 10px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}><Ico n="gear" s={18}/></button>}/>

    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <MonthPicker year={year} month={month} onChange={(y,m)=>{onMonthChange(y,m);loadRows(y,m)}}/>

      <button onClick={()=>setModal('new')} style={{background:C.yellow,color:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        + Нова відправка
      </button>

      <div style={{display:'flex',gap:8}}>
        {[['stats','Статистика'],['list','Відправки']].map(([k,l])=>
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'10px',minHeight:42,borderRadius:14,border:'none',background:tab===k?C.ink:'rgba(23,23,23,0.06)',color:tab===k?C.yellow:C.dim,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:tab===k?800:600}}>{l}</button>
        )}
      </div>

      {loading&&<div style={{textAlign:'center',color:C.muted,padding:20,fontSize:13}}>Завантаження...</div>}

      {/* ===== СТАТИСТИКА ===== */}
      {!loading&&tab==='stats'&&<>
        <Card top={C.accent}>
          <Lbl>Всього за місяць</Lbl>
          <div style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(totalAll)} шт</div>
          <div style={{fontSize:12,color:C.muted,marginTop:4}}>{groups.length} відправок</div>
        </Card>

        <div style={{display:'flex',gap:8}}>
          {[['mat','По матеріалах'],['firm','По фірмах']].map(([k,l])=>
            <button key={k} onClick={()=>setStatTab(k)} style={{flex:1,padding:'9px',minHeight:42,borderRadius:14,border:'none',background:statTab===k?C.ink:'rgba(23,23,23,0.06)',color:statTab===k?C.yellow:C.dim,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:statTab===k?800:600}}>{l}</button>
          )}
        </div>

        {rows.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>Ще немає відправок цього місяця</div>}

        {statTab==='mat'&&rows.length>0&&<Card>
          {Object.entries(matStats).sort((a,b)=>b[1].total-a[1].total).map(([name,data])=>(
            <MatStatRow key={name} name={name} data={data} accent={C.accent}/>
          ))}
        </Card>}

        {statTab==='firm'&&rows.length>0&&Object.entries(firmStats)
          .sort((a,b)=>b[1].total-a[1].total).map(([firm,fdata])=>(
          <Card key={firm}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
              <span style={{fontSize:14,fontWeight:700,color:C.accent}}>{firm}</span>
              <span style={{fontSize:12,color:C.muted}}>{fmt(fdata.total)} шт</span>
            </div>
            {Object.entries(fdata.materials).sort((a,b)=>b[1].total-a[1].total).map(([m,d])=>(
              <MatStatRow key={m} name={m} data={d}/>
            ))}
          </Card>
        ))}
      </>}

      {/* ===== СПИСОК ВІДПРАВОК ===== */}
      {!loading&&tab==='list'&&<>
        <button onClick={doExport} style={{background:'transparent',border:`1px solid ${C.green}`,color:C.green,borderRadius:10,padding:11,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          Звіт за 2 тижні
        </button>

        {firmNames.length>0&&<div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
          <button onClick={()=>setFirmFilter('')} style={{whiteSpace:'nowrap',padding:'6px 12px',borderRadius:20,border:`1px solid ${!firmFilter?C.accent:C.border}`,background:!firmFilter?'rgba(255,214,10,0.28)':'transparent',color:!firmFilter?C.accent:C.dim,cursor:'pointer',fontSize:12,fontFamily:'inherit',flexShrink:0}}>Всі</button>
          {firmNames.map(f=>(
            <button key={f} onClick={()=>setFirmFilter(f===firmFilter?'':f)} style={{whiteSpace:'nowrap',padding:'6px 12px',borderRadius:20,border:`1px solid ${firmFilter===f?C.accent:C.border}`,background:firmFilter===f?'rgba(255,214,10,0.28)':'transparent',color:firmFilter===f?C.accent:C.dim,cursor:'pointer',fontSize:12,fontFamily:'inherit',flexShrink:0}}>{f}</button>
          ))}
        </div>}

        {shownGroups.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>Немає відправок</div>}

        {shownGroups.map(g=>(
          <Card key={g.key}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{color:C.accent,fontWeight:700,fontSize:14}}>{g.firm}</span>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button onClick={()=>setModal({edit:g})} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.dim,borderRadius:6,padding:'3px 8px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}><Ico n="edit" s={16}/></button>
                <button onClick={()=>handleDeleteGroup(g)} style={{background:'transparent',border:`1px solid ${C.red}33`,color:C.red,borderRadius:6,padding:'3px 8px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}><Ico n="trash" s={16}/></button>
              </div>
            </div>
            {g.positions.map((pos,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:i<g.positions.length-1?`1px solid ${C.border2}`:'none'}}>
                <span style={{fontSize:13,color:C.text}}>
                  {pos.material}{pos.size?<span style={{color:C.dim}}> · {pos.size}</span>:''}
                </span>
                <span style={{fontSize:13,color:C.gold,fontWeight:700}}>{fmt(pos.qty)}</span>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',marginTop:8}}>
              <span style={{fontSize:12,color:C.muted}}>{g.positions.length} поз.</span>
              <span style={{fontSize:12,color:C.muted}}>{g.dateShort.split('-').reverse().join('.')}</span>
            </div>
          </Card>
        ))}
      </>}
    </div>

    {modal==='new'&&<ShipmentForm refs={refs} onClose={()=>setModal(null)}
      onSaved={loadRows} onRefsChanged={loadRefs} tgId={tgId} tgName={tgName}/>}
    {modal&&modal.edit&&<ShipmentForm refs={refs} editGroup={modal.edit} onClose={()=>setModal(null)}
      onSaved={loadRows} onRefsChanged={loadRefs} tgId={tgId} tgName={tgName}/>}
    {modal==='refs'&&<RefsManager refs={refs} onClose={()=>setModal(null)} onChanged={loadRefs}/>}

    {report!==null&&<Sheet onClose={()=>setReport(null)} title="Звіт — 2 тижні">
      <pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:13,color:C.text,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:14,margin:0,maxHeight:'50vh',overflowY:'auto'}}>{report}</pre>
      <button onClick={()=>{
        if (navigator.share) navigator.share({text:report}).catch(()=>{})
        else { navigator.clipboard?.writeText(report); alert('Скопійовано!') }
        vibrate('light')
      }} style={{marginTop:12,width:'100%',background:C.yellow,color:C.ink,border:'none',borderRadius:10,padding:13,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        Скопіювати / Поділитись
      </button>
    </Sheet>}
  </div>
}

// ================================================================
// ФОРМА ПРИЙОМУ СИРОВИНИ
// ================================================================
function IntakeForm({suppliers,editRow,onClose,onSaved,onRefsChanged,tgId,tgName}) {
  const isEdit = !!editRow
  const [supplier,  setSupplier]  = useState(editRow?.supplier||'')
  const [dateShort, setDateShort] = useState(editRow?.dateShort||todayStr())
  const [cubes,     setCubes]     = useState(editRow?.cubes||0)
  const [wood,      setWood]      = useState(editRow?.wood||'')
  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState(false)
  const [error,     setError]     = useState(null)

  const addCubes = n => { vibrate('light'); setCubes(c=>Math.round((Number(c)+n)*10)/10) }

  async function submit(e) {
    e.preventDefault()
    if (!supplier.trim()) { setError('Вкажи постачальника'); return }
    if (!wood)            { setError('Обери вид лісу'); return }
    if (!cubes||cubes<=0) { setError('Вкажи кубатуру'); return }
    try {
      setLoading(true); setError(null)
      const known = suppliers.map(s=>s.name)
      if (supplier.trim() && !known.includes(supplier.trim())) await addSupplier(supplier.trim())
      if (isEdit) {
        await updateIntake(editRow.id, { supplier:supplier.trim(), wood, cubes, date:editRow.date })
        await writeLog({tgId,name:tgName,action:'Редаг. прийом',details:`${supplier}: ${wood} ${cubes}куб`})
      } else {
        await saveIntake({ supplier:supplier.trim(), wood, cubes, date:dateShort })
        await writeLog({tgId,name:tgName,action:'Прийом сировини',details:`${supplier}: ${wood} ${cubes}куб`})
      }
      await onRefsChanged()
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1100)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title={isEdit?'Редагувати прийом':'Новий прийом'}>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <ComboField label="ЗВІДКИ (постачальник)" value={supplier} onChange={setSupplier} options={suppliers} placeholder="оберіть або впишіть"/>

      <div><Lbl>ДАТА</Lbl>
        <input type="date" value={dateShort} max={todayStr()} disabled={isEdit}
          onChange={e=>setDateShort(e.target.value)} style={{...inp,opacity:isEdit?0.6:1}}/>
      </div>

      <div>
        <Lbl>КУБАТУРА</Lbl>
        <input type="number" inputMode="decimal" value={cubes} onChange={e=>setCubes(e.target.value)}
          style={{...inp,fontSize:26,fontWeight:700,textAlign:'center',color:C.accent,padding:'14px'}}/>
        <div style={{display:'flex',gap:6,marginTop:8}}>
          <button type="button" onClick={()=>addCubes(1)}  style={cubeBtn}>+1</button>
          <button type="button" onClick={()=>addCubes(5)}  style={cubeBtn}>+5</button>
          <button type="button" onClick={()=>addCubes(10)} style={cubeBtn}>+10</button>
          <button type="button" onClick={()=>{vibrate('medium');setCubes(0)}} style={{...cubeBtn,color:C.red,borderColor:`${C.red}44`}}>Скинути</button>
        </div>
      </div>

      <div>
        <Lbl>ВИД ЛІСУ</Lbl>
        <div style={{display:'flex',gap:8}}>
          {WOOD_TYPES.map(w=>(
            <button key={w} type="button" onClick={()=>{vibrate('light');setWood(w)}}
              style={{flex:1,padding:'12px 4px',borderRadius:10,fontSize:13,fontFamily:'inherit',cursor:'pointer',fontWeight:wood===w?700:400,
                border:`1px solid ${wood===w?C.accent:C.border}`,
                background:wood===w?'rgba(23,23,23,0.12)':'transparent',
                color:wood===w?C.accent:C.dim}}>{w}</button>
          ))}
        </div>
      </div>

      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.ink:C.yellow,color:success?C.yellow:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?<Done/>:isEdit?'Зберегти зміни':'Зберегти прийом'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// КЕРУВАННЯ ПОСТАЧАЛЬНИКАМИ
// ================================================================
function SuppliersManager({suppliers,onClose,onChanged}) {
  const [newVal, setNewVal] = useState('')
  const [busy,   setBusy]   = useState(false)

  async function handleAdd() {
    if (!newVal.trim()||busy) return
    try { setBusy(true); await addSupplier(newVal.trim()); setNewVal(''); await onChanged(); vibrate('light') }
    catch(e){ alert('Помилка: '+e.message) } finally{ setBusy(false) }
  }
  async function handleDel(item) {
    if (!confirm(`Видалити «${item.name}»?\n\nСтарі прийоми залишаться недоторкані.`)) return
    try { setBusy(true); await deleteSupplier(item.id); await onChanged(); vibrate('medium') }
    catch(e){ alert('Помилка: '+e.message) } finally{ setBusy(false) }
  }

  return <Sheet onClose={onClose} title="Постачальники">
    <div style={{display:'flex',gap:6,marginBottom:14}}>
      <input value={newVal} onChange={e=>setNewVal(e.target.value)} placeholder="Новий постачальник..." style={{...inp,fontSize:13}}/>
      <button onClick={handleAdd} disabled={busy} style={{background:C.green,border:'none',color:'#fff',borderRadius:8,padding:'0 16px',fontSize:18,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>+</button>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:'55vh',overflowY:'auto'}}>
      {suppliers.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:13,padding:20}}>Список порожній</div>}
      {suppliers.map(item=>(
        <div key={item.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px'}}>
          <span style={{fontSize:14,color:C.text}}>{item.name}</span>
          <button onClick={()=>handleDel(item)} disabled={busy} style={{background:'transparent',border:`1px solid ${C.red}33`,color:C.red,borderRadius:6,padding:'4px 10px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Видалити</button>
        </div>
      ))}
    </div>
  </Sheet>
}

// ================================================================
// РОЗДІЛ ПРИЙОМУ СИРОВИНИ
// ================================================================
function IntakeView({onBack,tgId,tgName,year,month,onMonthChange}) {
  const [suppliers, setSuppliers] = useState([])
  const [rows,      setRows]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null)   // 'new' | 'suppliers' | {edit:row}
  const [tab,       setTab]       = useState('stats') // stats | list
  const [statTab,   setStatTab]   = useState('wood')  // wood | supplier
  const [supFilter, setSupFilter] = useState('')
  const [report,    setReport]    = useState(null)

  const loadSuppliers = useCallback(async()=>{
    try { setSuppliers(await fetchSuppliers()) } catch(e){}
  },[])
  const loadRows = useCallback(async(y,m)=>{
    try { setLoading(true); setRows(await fetchIntake(y??year,m??month)) }
    catch(e){} finally{ setLoading(false) }
  },[year,month])

  useEffect(()=>{ loadSuppliers(); loadRows() },[])

  const woodStats = intakeStatsByWood(rows)
  const supStats  = intakeStatsBySupplier(rows)
  const supNames  = Object.keys(supStats).sort((a,b)=>a.localeCompare(b,'uk'))
  const shownRows = supFilter ? rows.filter(r=>r.supplier===supFilter) : rows

  async function handleDelete(r) {
    if (!confirm(`Видалити прийом?\n\n${r.supplier} — ${r.wood} ${r.cubes} куб\n${r.dateShort.split('-').reverse().join('.')}`)) return
    try { await deleteIntake(r.id); vibrate('medium'); loadRows() }
    catch(e){ alert(e.message) }
  }

  return <div className="view-in" style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title="Прийом сировини" sub={`${MONTHS_UA[month]} ${year}`} onBack={onBack}
      right={<button onClick={()=>setModal('suppliers')} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.purple,borderRadius:8,padding:'6px 10px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}><Ico n="gear" s={18}/></button>}/>

    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <MonthPicker year={year} month={month} onChange={(y,m)=>{onMonthChange(y,m);loadRows(y,m)}}/>

      <button onClick={()=>setModal('new')} style={{background:C.yellow,color:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        + Новий прийом
      </button>

      <div style={{display:'flex',gap:8}}>
        {[['stats','Статистика'],['list','Прийоми']].map(([k,l])=>
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'10px',minHeight:42,borderRadius:14,border:'none',background:tab===k?C.ink:'rgba(23,23,23,0.06)',color:tab===k?C.yellow:C.dim,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:tab===k?800:600}}>{l}</button>
        )}
      </div>

      {loading&&<div style={{textAlign:'center',color:C.muted,padding:20,fontSize:13}}>Завантаження...</div>}

      {/* ===== СТАТИСТИКА ===== */}
      {!loading&&tab==='stats'&&<>
        <Card top={C.accent}>
          <Lbl>Прийнято всього за місяць</Lbl>
          <div style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(woodStats.total)} куб</div>
          <div style={{fontSize:12,color:C.muted,marginTop:4}}>{rows.length} прийомів</div>
        </Card>

        <div style={{display:'flex',gap:8}}>
          {[['wood','По лісу'],['supplier','По постачальниках']].map(([k,l])=>
            <button key={k} onClick={()=>setStatTab(k)} style={{flex:1,padding:'9px',minHeight:42,borderRadius:14,border:'none',background:statTab===k?C.ink:'rgba(23,23,23,0.06)',color:statTab===k?C.yellow:C.dim,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:statTab===k?800:600}}>{l}</button>
          )}
        </div>

        {rows.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>Ще немає прийомів цього місяця</div>}

        {statTab==='wood'&&rows.length>0&&<Card>
          {Object.entries(woodStats.woods).sort((a,b)=>b[1]-a[1]).map(([w,c])=>(
            <Row key={w} label={w} value={`${fmt(c)} куб`} color={C.text}/>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',paddingTop:10,fontSize:13}}>
            <span style={{color:C.muted}}>Всього</span>
            <span style={{color:C.accent,fontWeight:700}}>{fmt(woodStats.total)} куб</span>
          </div>
        </Card>}

        {statTab==='supplier'&&rows.length>0&&Object.entries(supStats)
          .sort((a,b)=>b[1].total-a[1].total).map(([sup,d])=>(
          <Card key={sup}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
              <span style={{fontSize:14,fontWeight:700,color:C.accent}}>{sup}</span>
              <span style={{fontSize:12,color:C.muted}}>{fmt(d.total)} куб</span>
            </div>
            {Object.entries(d.woods).sort((a,b)=>b[1]-a[1]).map(([w,c])=>(
              <Row key={w} label={w} value={`${fmt(c)} куб`} color={C.text}/>
            ))}
          </Card>
        ))}
      </>}

      {/* ===== СПИСОК ===== */}
      {!loading&&tab==='list'&&<>
        <button onClick={()=>setReport(buildIntakeReport(rows,14))} style={{background:'transparent',border:`1px solid ${C.green}`,color:C.green,borderRadius:10,padding:11,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          Звіт за 2 тижні
        </button>

        {supNames.length>0&&<div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
          <button onClick={()=>setSupFilter('')} style={{whiteSpace:'nowrap',padding:'6px 12px',borderRadius:20,border:`1px solid ${!supFilter?C.accent:C.border}`,background:!supFilter?'rgba(255,214,10,0.28)':'transparent',color:!supFilter?C.accent:C.dim,cursor:'pointer',fontSize:12,fontFamily:'inherit',flexShrink:0}}>Всі</button>
          {supNames.map(s=>(
            <button key={s} onClick={()=>setSupFilter(s===supFilter?'':s)} style={{whiteSpace:'nowrap',padding:'6px 12px',borderRadius:20,border:`1px solid ${supFilter===s?C.accent:C.border}`,background:supFilter===s?'rgba(255,214,10,0.28)':'transparent',color:supFilter===s?C.accent:C.dim,cursor:'pointer',fontSize:12,fontFamily:'inherit',flexShrink:0}}>{s}</button>
          ))}
        </div>}

        {shownRows.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>Немає прийомів</div>}

        {shownRows.map(r=>(
          <Card key={r.id}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{color:C.accent,fontWeight:700,fontSize:14}}>{r.supplier}</span>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button onClick={()=>setModal({edit:r})} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.dim,borderRadius:6,padding:'3px 8px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}><Ico n="edit" s={16}/></button>
                <button onClick={()=>handleDelete(r)} style={{background:'transparent',border:`1px solid ${C.red}33`,color:C.red,borderRadius:6,padding:'3px 8px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}><Ico n="trash" s={16}/></button>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:13,color:C.text}}>{r.wood}</span>
              <span style={{fontSize:14,color:C.gold,fontWeight:700}}>{fmt(r.cubes)} куб</span>
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:6,textAlign:'right'}}>{r.dateShort.split('-').reverse().join('.')}</div>
          </Card>
        ))}
      </>}
    </div>

    {modal==='new'&&<IntakeForm suppliers={suppliers} onClose={()=>setModal(null)}
      onSaved={loadRows} onRefsChanged={loadSuppliers} tgId={tgId} tgName={tgName}/>}
    {modal&&modal.edit&&<IntakeForm suppliers={suppliers} editRow={modal.edit} onClose={()=>setModal(null)}
      onSaved={loadRows} onRefsChanged={loadSuppliers} tgId={tgId} tgName={tgName}/>}
    {modal==='suppliers'&&<SuppliersManager suppliers={suppliers} onClose={()=>setModal(null)} onChanged={loadSuppliers}/>}

    {report!==null&&<Sheet onClose={()=>setReport(null)} title="Звіт — 2 тижні">
      <pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:13,color:C.text,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:14,margin:0,maxHeight:'50vh',overflowY:'auto'}}>{report}</pre>
      <button onClick={()=>{
        if (navigator.share) navigator.share({text:report}).catch(()=>{})
        else { navigator.clipboard?.writeText(report); alert('Скопійовано!') }
        vibrate('light')
      }} style={{marginTop:12,width:'100%',background:C.yellow,color:C.ink,border:'none',borderRadius:10,padding:13,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        Скопіювати / Поділитись
      </button>
    </Sheet>}
  </div>
}

const cubeBtn = {flex:1,padding:'10px 0',borderRadius:8,border:`1px solid rgba(23,23,23,0.3)`,background:'rgba(23,23,23,0.08)',color:'#38bdf8',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}

// ================================================================
// ПАЛИВО
// ================================================================
function FuelForm({editRow,onClose,onSaved,tgId,tgName}) {
  const isEdit = !!editRow
  const [ftype,   setFtype]   = useState(editRow?.type||'Дизель')
  const [grade,   setGrade]   = useState(editRow?.grade||'')
  const [liters,  setLiters]  = useState(editRow?.liters||'')
  const [amount,  setAmount]  = useState(editRow?.amount||'')
  const [date,    setDate]    = useState(editRow?.dateShort||todayStr())
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!liters||!amount) { setError('Вкажи літри і суму'); return }
    if (ftype==='Бензин'&&!grade) { setError('Вибери марку бензину'); return }
    try {
      setLoading(true); setError(null)
      const g = ftype==='Дизель' ? '' : grade
      if (isEdit) await updateFuel(editRow.id, {type:ftype,grade:g,liters,amount,date})
      else        await saveFuel({type:ftype,grade:g,liters,amount,date})
      await writeLog({tgId,name:tgName,action:isEdit?'Редаг. паливо':'Паливо',details:`${ftype}${g?' '+g:''}: ${liters}л / ${amount}грн`})
      vibrate('success'); setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1100)
    } catch(e){vibrate('error');setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title={isEdit?'Редагувати запис':'Внести паливо'}>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div>
        <Lbl>ВИД ПАЛИВА</Lbl>
        <div style={{display:'flex',gap:8}}>
          {FUEL_TYPES.map(t=>(
            <button key={t} type="button" onClick={()=>{setFtype(t);setGrade('')}}
              style={{flex:1,padding:'12px 4px',borderRadius:10,fontSize:13,fontFamily:'inherit',cursor:'pointer',fontWeight:ftype===t?700:400,
                border:`1px solid ${ftype===t?C.accent:C.border}`,
                background:ftype===t?'rgba(23,23,23,0.12)':'transparent',
                color:ftype===t?C.accent:C.dim}}>{t}</button>
          ))}
        </div>
      </div>

      {ftype==='Бензин'&&<div>
        <Lbl>МАРКА</Lbl>
        <div style={{display:'flex',gap:6}}>
          {FUEL_GRADES.map(g=>(
            <button key={g} type="button" onClick={()=>setGrade(g)}
              style={{flex:1,minHeight:42,padding:'10px 4px',borderRadius:14,fontSize:13,fontFamily:'inherit',cursor:'pointer',fontWeight:grade===g?800:600,
                border:'none',
                background:grade===g?C.ink:'rgba(23,23,23,0.06)',
                color:grade===g?C.yellow:C.dim}}>{g}</button>
          ))}
        </div>
      </div>}

      <div><Lbl>ДАТА</Lbl><input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} style={inp}/></div>
      <div><Lbl>ЛІТРИ</Lbl><input type="number" inputMode="decimal" step="0.1" value={liters} onChange={e=>setLiters(e.target.value)} placeholder="напр. 50" style={inp}/></div>
      <div><Lbl>СУМА (грн)</Lbl><input type="number" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="напр. 3500" style={inp}/></div>

      {liters&&amount&&<div style={{background:'rgba(34,197,94,0.08)',border:`1px solid rgba(34,197,94,0.2)`,borderRadius:10,padding:'10px 14px',display:'flex',justifyContent:'space-between'}}>
        <span style={{fontSize:12,color:C.dim}}>Ціна за літр</span>
        <span style={{fontSize:14,fontWeight:700,color:C.green}}>{fmt(Math.round(amount/liters*100)/100)} ₴/л</span>
      </div>}

      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>{error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.ink:C.yellow,color:success?C.yellow:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?<Done/>:isEdit?'Зберегти зміни':'Зберегти'}
      </button>
    </form>
  </Sheet>
}

function FuelView({onBack,tgId,tgName,year,month,onMonthChange,isOwner}) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null) // 'new' | {edit:row}
  const [tab,     setTab]     = useState('stats')

  const loadRows = useCallback(async(y,m)=>{
    try { setLoading(true); setRows(await fetchFuel(y??year,m??month)) }
    catch(e){} finally{ setLoading(false) }
  },[year,month])

  useEffect(()=>{ loadRows() },[])

  const stats = fuelStats(rows)

  async function handleDelete(r) {
    if (!confirm(`Видалити запис?\n${r.type}${r.grade?' '+r.grade:''} · ${r.liters}л · ${r.amount}грн`)) return
    try { await deleteFuel(r.id); vibrate('medium'); loadRows() }
    catch(e){ alert(e.message) }
  }

  return <div className="view-in" style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title="Паливо" sub={`${MONTHS_UA[month]} ${year}`} onBack={onBack}/>

    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <MonthPicker year={year} month={month} onChange={(y,m)=>{onMonthChange(y,m);loadRows(y,m)}}/>

      <button onClick={()=>setModal('new')} style={{background:C.yellow,color:C.ink,border:'none',borderRadius:16,padding:16,fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
        + Внести паливо
      </button>

      <div style={{display:'flex',gap:8}}>
        {[['stats','Статистика'],['list','Записи']].map(([k,l])=>
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'10px',minHeight:42,borderRadius:14,border:'none',background:tab===k?C.ink:'rgba(23,23,23,0.06)',color:tab===k?C.yellow:C.dim,cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:tab===k?800:600}}>{l}</button>
        )}
      </div>

      {loading&&<div style={{textAlign:'center',color:C.muted,padding:20,fontSize:13}}>Завантаження...</div>}

      {!loading&&tab==='stats'&&<>
        <Card top={C.accent}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><div style={{fontSize:12,color:C.muted,marginBottom:4}}>Витрачено</div><div style={{fontSize:20,fontWeight:700,color:C.accent}}>{fmt(stats.totalAmount)} ₴</div></div>
            <div><div style={{fontSize:12,color:C.muted,marginBottom:4}}>Літрів</div><div style={{fontSize:20,fontWeight:700,color:C.gold}}>{fmt(stats.totalLiters)} л</div></div>
          </div>
        </Card>

        {rows.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>Ще немає записів цього місяця</div>}

        {Object.entries(stats.byType).sort((a,b)=>b[1].amount-a[1].amount).map(([name,d])=>(
          <Card key={name}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
              <span style={{fontSize:15,fontWeight:700,color:C.text}}>{name}</span>
            </div>
            <Row label="Витрачено" value={`${fmt(d.amount)} ₴`} color={C.accent}/>
            <Row label="Літрів" value={`${fmt(d.liters)} л`} color={C.gold}/>
            {d.liters>0&&<Row label="Ціна за літр" value={`${fmt(Math.round(d.amount/d.liters*100)/100)} ₴/л`} color={C.dim} last/>}
          </Card>
        ))}
      </>}

      {!loading&&tab==='list'&&<>
        {rows.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>Немає записів</div>}
        {rows.map(r=>(
          <Card key={r.id}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{color:C.accent,fontWeight:700,fontSize:15}}>{r.type}{r.grade?' '+r.grade:''}</span>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setModal({edit:r})} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.dim,borderRadius:6,padding:'3px 8px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}><Ico n="edit" s={16}/></button>
                <button onClick={()=>handleDelete(r)} style={{background:'transparent',border:`1px solid ${C.red}33`,color:C.red,borderRadius:6,padding:'3px 8px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}><Ico n="trash" s={16}/></button>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div style={{fontSize:13}}><span style={{color:C.dim}}>Літри: </span><b>{fmt(r.liters)} л</b></div>
              <div style={{fontSize:13}}><span style={{color:C.dim}}>Сума: </span><b style={{color:C.accent}}>{fmt(r.amount)} ₴</b></div>
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:6,textAlign:'right'}}>{r.dateShort.split('-').reverse().join('.')}</div>
          </Card>
        ))}
      </>}
    </div>

    {modal==='new'&&<FuelForm onClose={()=>setModal(null)} onSaved={loadRows} tgId={tgId} tgName={tgName}/>}
    {modal?.edit&&<FuelForm editRow={modal.edit} onClose={()=>setModal(null)} onSaved={loadRows} tgId={tgId} tgName={tgName}/>}
  </div>
}

// ================================================================
// ПОКАЗНИКИ СВІТЛА
// ================================================================
function ElectricityView({onBack,tgId,tgName,cfg}) {
  const tariff = cfg?.electricityTariff||0
  const [allRows, setAllRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [newVal,  setNewVal]  = useState('')
  const [newDate, setNewDate] = useState(todayStr())
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  const loadData = useCallback(async()=>{
    try { setLoading(true); setAllRows(await fetchElectricityAll()) }
    catch(e){} finally{ setLoading(false) }
  },[])

  useEffect(()=>{ loadData() },[])

  const withDiff = calcElectricity(allRows, tariff)
  const totalKwh = withDiff.reduce((s,r)=>s+(r.diff||0),0)
  const totalAmt = withDiff.reduce((s,r)=>s+(r.amount||0),0)

  async function handleSave(e) {
    e.preventDefault()
    if (!newVal) { setError('Введи показник'); return }
    try {
      setSaving(true); setError(null)
      await saveElectricity({value:newVal, date:newDate})
      await writeLog({tgId,name:tgName,action:'Показник світла',details:`${newVal} кВт · ${newDate}`})
      vibrate('success'); setNewVal('')
      loadData()
    } catch(e){vibrate('error');setError(e.message)} finally{setSaving(false)}
  }

  async function handleDelete(r) {
    if (!confirm(`Видалити показник ${r.value} кВт від ${r.dateShort.split('-').reverse().join('.')}?`)) return
    try { await deleteElectricity(r.id); vibrate('medium'); loadData() }
    catch(e){ alert(e.message) }
  }

  return <div className="view-in" style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title="Показники світла" onBack={onBack}/>

    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>

      {/* Загальна статистика */}
      {!loading&&withDiff.length>1&&<Card top={C.gold}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><div style={{fontSize:12,color:C.muted,marginBottom:4}}>Всього використано</div><div style={{fontSize:20,fontWeight:700,color:C.gold}}>{fmt(totalKwh)} кВт·год</div></div>
          {tariff>0&&<div><div style={{fontSize:12,color:C.muted,marginBottom:4}}>Загальна сума</div><div style={{fontSize:20,fontWeight:700,color:C.accent}}>{fmt(totalAmt)} ₴</div></div>}
        </div>
        {tariff===0&&<div style={{fontSize:12,color:C.muted,marginTop:8}}>Вкажи тариф у налаштуваннях</div>}
      </Card>}

      {/* Форма внесення */}
      <Card>
        <Lbl>НОВИЙ ПОКАЗНИК</Lbl>
        <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',gap:10}}>
          <input type="number" inputMode="numeric" value={newVal} onChange={e=>setNewVal(e.target.value)}
            placeholder="напр. 12450" style={inp}/>
          <input type="date" value={newDate} max={todayStr()} onChange={e=>setNewDate(e.target.value)} style={inp}/>
          {error&&<div style={{color:C.red,fontSize:12}}>{error}</div>}
          <button type="submit" disabled={saving} style={{background:C.yellow,color:C.ink,border:'none',borderRadius:14,padding:14,fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
            {saving?'Збереження...':'Внести показник'}
          </button>
        </form>
      </Card>

      {loading&&<div style={{textAlign:'center',color:C.muted,padding:20,fontSize:13}}>Завантаження...</div>}

      {/* Список всіх записів */}
      {!loading&&allRows.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>Ще немає жодного запису</div>}

      {!loading&&withDiff.slice().reverse().map(r=>(
        <Card key={r.id}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:12,color:C.muted,marginBottom:4}}>{r.dateShort.split('-').reverse().join('.')}</div>
              <div style={{fontSize:20,fontWeight:700,color:C.text}}>{r.value.toLocaleString()} кВт</div>
              {r.diff!==null&&<div style={{fontSize:12,color:C.gold,marginTop:3}}>
                використано: {fmt(r.diff)} кВт·год
                {tariff>0&&r.amount!==null&&` · ${fmt(r.amount)} ₴`}
              </div>}
            </div>
            <button onClick={()=>handleDelete(r)} style={{background:'transparent',border:`1px solid ${C.red}33`,color:C.red,borderRadius:8,padding:'6px 10px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}><Ico n="trash" s={16}/></button>
          </div>
        </Card>
      ))}
    </div>
  </div>
}

// ================================================================
// СТАТИСТИКА ПО МІСЯЦЯХ
// ================================================================
function MonthlyStats({tgId,name,onBack}) {
  const [stats,   setStats]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    fetchMonthlyStats(tgId,6).then(s=>{setStats(s);setLoading(false)}).catch(()=>setLoading(false))
  },[tgId])

  if (loading) return <Spinner/>

  const maxEarned = Math.max(...stats.map(s=>s.earned),1)

  return <div className="view-in" style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title="Статистика" sub={name} onBack={onBack}/>
    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <Card>
        <SecTitle>Заробіток по місяцях</SecTitle>
        <BarsChart data={stats.map((s,i)=>({x:s.month,v:s.earned,hi:i===stats.length-1}))} height={190} unit="₴" tickFmt={kfmt} valueFmt={kfmt}
          label="Заробіток по місяцях" hint="Торкнись стовпчика, щоб побачити місяць"
          detail={(d,i)=><><b style={{fontSize:14}}>{MONTHS_UA[stats[i].monthIdx]} {stats[i].year}</b><span style={{fontWeight:500}}>{fmt(stats[i].earned)} ₴ · {fmtH(stats[i].hours)} год</span></>}
          legend={[{c:C.ink,t:'Минулі місяці'},{c:C.yellow,line:true,t:'Поточний'}]}/>
      </Card>

      <Card>
        <SecTitle>Години по місяцях</SecTitle>
        <BarsChart data={stats.map((s,i)=>({x:s.month,v:s.hours,hi:i===stats.length-1}))} height={170} unit="год" tickFmt={v=>v} valueFmt={v=>String(Math.round(v))}
          label="Години по місяцях" hint="Торкнись стовпчика, щоб побачити місяць"
          detail={(d,i)=><><b style={{fontSize:14}}>{MONTHS_UA[stats[i].monthIdx]} {stats[i].year}</b><span style={{fontWeight:500}}>{fmtH(stats[i].hours)} год · {stats[i].packs} {plural(stats[i].packs,'пачка','пачки','пачок')}</span></>}/>
      </Card>

      <Card>
        <SecTitle>ДЕТАЛІ</SecTitle>
        {stats.slice().reverse().map((s,i)=>(
          <div key={i} style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:13}}>
              <span style={{color:C.dim}}>{s.month}</span>
              <span style={{color:C.accent,fontWeight:600}}>{fmt(s.earned)} ₴</span>
            </div>
            <Prog val={s.earned} max={maxEarned} color={C.accent}/>
            <div style={{display:'flex',gap:12,marginTop:3,fontSize:11.5,color:C.muted}}>
              <span>{fmtH(s.hours)} год</span>
              <span>{s.packs} пачок</span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  </div>
}

// ================================================================
// ДЕТАЛІ РОБІТНИКА
// ================================================================
function WorkerDetail({w,allWorkers,onBack,onRefresh,tgId,tgName,cfg,isOwner,month,year}) {
  const [modal,    setModal]    = useState(null)
  const [editDay,  setEditDay]  = useState(null)
  const [showStats,setShowStats]= useState(false)
  const [payslip,  setPayslip]  = useState(false)
  const [motiv]                 = useState(randomMotiv())

  if (showStats) return <MonthlyStats tgId={w.tgId} name={w.name} onBack={()=>setShowStats(false)}/>


  return <div className="view-in" style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title={w.name} sub={w.type==='fixed'?(w.role||'Фіксована'):'Погодинний + пачки'} onBack={onBack}
      right={isOwner&&<div style={{display:'flex',gap:6}}>
        <IconBtn onClick={()=>setModal('edit')} label="Редагувати"><Ico n="user" s={20}/></IconBtn>
        <button onClick={()=>{vibrate('light');setModal('rates')}} style={{background:C.yellow,border:'none',color:C.ink,borderRadius:20,padding:'0 16px',height:40,fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>Ставки</button>
      </div>}/>

    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <PayHero w={w} month={month}/>

      {w.daysSinceEntry>=2&&w.type==='shift'&&year===new Date().getFullYear()&&month===new Date().getMonth()&&<div style={{background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:10,padding:'10px 14px',fontSize:12,color:C.red}}>
        Не вносив дані {w.daysSinceEntry} {plural(w.daysSinceEntry,'день','дні','днів')}
      </div>}

      {w.fines?.length>0&&<div style={{background:`${C.red}11`,border:`2px solid ${C.red}`,borderRadius:20,padding:'14px 16px'}}>
        <div style={{fontSize:13,fontWeight:800,color:C.red,marginBottom:8}}>Штраф</div>
        {w.fines.map((f,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:13,padding:'4px 0'}}>
          <span style={{color:C.text}}>{f.reason||'Без причини'}<span style={{color:C.muted,fontSize:11.5}}> · {f.date}</span></span>
          <span style={{color:C.red,fontWeight:700,whiteSpace:'nowrap'}}>-{fmt(f.amount)} ₴</span>
        </div>)}
        {w.fines.length>1&&<div style={{borderTop:`1px solid ${C.red}33`,marginTop:6,paddingTop:6,display:'flex',justifyContent:'space-between',fontSize:12,color:C.red,fontWeight:700}}><span>Разом</span><span>-{fmt(w.totalFines)} ₴</span></div>}
        <div style={{fontSize:11.5,color:C.muted,marginTop:6}}>Віднімається від виплати</div>
      </div>}

      {/* Мотивація */}
      {!isOwner&&<div style={{background:'rgba(255,214,10,0.28)',borderRadius:16,padding:'12px 14px',fontSize:13,fontWeight:600,color:C.ink,textAlign:'center'}}>{motiv}</div>}

      {/* Кнопки */}
      <div className="stagger" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {w.type==='shift'&&<Tile i={0} n="clock" label="Зміна" primary onClick={()=>setModal('shift')}/>}
        {isOwner&&<Tile i={1} n="star" label="Премія" onClick={()=>setModal('bonus')}/>}
        {isOwner&&<Tile i={2} n="ban" label="Штраф" danger onClick={()=>setModal('fine')}/>}
        <Tile i={3} n="card" label="Аванс" onClick={()=>setModal('advance')}/>
        {isOwner&&<Tile i={4} n="wallet" label="Борг" onClick={()=>setModal('debt')}/>}
        {w.debtRemaining>0&&<Tile i={5} n="check" label="Виплата боргу" onClick={()=>setModal('debtpay')}/>}
        <Tile i={6} n="chart" label="Статистика" onClick={()=>setShowStats(true)}/>
        <Tile i={7} n="doc" label="Листок" onClick={()=>setPayslip(true)}/>
      </div>

      {w.type==='shift'&&<>
        {(w.days||[]).length>0&&<Card>
          <SecTitle>Години по днях</SecTitle>
          <HoursChart w={w} year={year} month={month} cfg={cfg}/>
        </Card>}

        <ProgressCard w={w}/>
      </>}

      <Card>
        <SecTitle>РОЗБИВКА</SecTitle>
        {w.lowRateApplied&&<div style={{fontSize:12,color:C.red,background:`${C.red}11`,borderRadius:8,padding:'6px 10px',marginBottom:8}}>
          Застосована знижена ставка: менше {w.lowRateDays} робочих днів за місяць
        </div>}
        {w.type==='shift'&&<>
          <Row label={`Погодинно (${fmtH(w.totalHours)} × ${fmt(w.rateHour)} ₴)`} value={`${fmt(w.earnHours)} ₴`}/>
          <Row label={`Пачки (${w.totalPacks} × ${fmt(w.ratePack)} ₴)`} value={`${fmt(w.earnPacks)} ₴`}/>
          {w.bonusLong>0&&<Row label={`Бонус 10+ год (${w.longDays}×)`} value={`+${fmt(w.bonusLong)} ₴`} color={C.gold}/>}
          {w.bonusSat>0&&<Row label={`Бонус суботи (${w.saturdays}×)`} value={`+${fmt(w.bonusSat)} ₴`} color={C.gold}/>}
          {w.premium>0&&<Row label="Премія" value={`+${fmt(w.premium)} ₴`} color={C.green}/>}
          {w.manualBonus>0&&<Row label="Ручні премії" value={`+${fmt(w.manualBonus)} ₴`} color={C.green}/>}
        </>}
        {w.type==='fixed'&&<Row label="Фіксована ставка" value={`${fmt(w.gross)} ₴`}/>}
        <Row label="Нараховано" value={`${fmt(w.gross)} ₴`} bold/>
        {w.totalAdv>0&&<Row label="Аванси" value={`-${fmt(w.totalAdv)} ₴`} color={C.red}/>}
        {w.totalFines>0&&<Row label="Штрафи" value={`-${fmt(w.totalFines)} ₴`} color={C.red}/>}
        {w.debtPaid>0&&<Row label="Виплата боргу" value={`-${fmt(w.debtPaid)} ₴`} color={C.red}/>}
        <div style={{display:'flex',justifyContent:'space-between',paddingTop:12}}>
          <span style={{color:C.muted,fontSize:12}}>ДО ВИПЛАТИ</span>
          <span style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(w.final)} ₴</span>
        </div>
        {w.debtRemaining>0&&<div style={{marginTop:10,padding:'8px 12px',background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:8,fontSize:12,color:C.red}}>
          Залишок боргу: {fmt(w.debtRemaining)} ₴
        </div>}
      </Card>

      {w.type==='shift'&&w.days?.length>0&&<Card>
        <SecTitle>ДЕТАЛІ ПО ДНЯХ</SecTitle>
        <DaysExpand days={w.days} rateHour={w.rateHour} ratePack={w.ratePack} longDayHours={cfg?.longDayHours} isOwner={isOwner} onEdit={isOwner?setEditDay:null}/>
      </Card>}

      {w.advances?.length>0&&<Card>
        <SecTitle>АВАНСИ</SecTitle>
        {w.advances.map((a,i)=><Row key={i} label={a.date} value={`${fmt(a.amount)} ₴`} color={C.gold} last={i===w.advances.length-1}/>)}
      </Card>}

      {w.fines?.length>0&&<Card>
        <SecTitle>ШТРАФИ</SecTitle>
        {w.fines.map((f,i)=><Row key={i} label={f.date} value={`-${fmt(f.amount)} ₴`} color={C.red} sub={f.reason} last={i===w.fines.length-1}/>)}
      </Card>}

      {w.bonuses?.length>0&&<Card>
        <SecTitle>ПРЕМІЇ</SecTitle>
        {w.bonuses.map((b,i)=><Row key={i} label={b.date} value={`+${fmt(b.amount)} ₴`} color={C.green} sub={b.reason} last={i===w.bonuses.length-1}/>)}
      </Card>}
    </div>

    {modal==='shift'  &&<ShiftForm worker={w} allWorkers={allWorkers} isOwner={isOwner} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName} cfg={cfg}/>}
    {modal==='bonus'  &&<BonusForm worker={w} allWorkers={allWorkers} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='fine'   &&<FineForm worker={w} allWorkers={allWorkers} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='advance'&&<AdvanceForm worker={w} allWorkers={allWorkers} isOwner={isOwner} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='debt'   &&<AddDebtForm worker={w} allWorkers={allWorkers} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='debtpay'&&<DebtPaymentForm worker={w} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='rates'  &&<RatesForm year={year} month={month} worker={w} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName} cfg={cfg}/>}
    {modal==='edit'   &&<EditWorkerForm worker={w} onClose={()=>setModal(null)} onSaved={()=>{onBack();onRefresh()}} tgId={tgId} tgName={tgName}/>}
    {editDay&&<EditDayForm day={editDay} worker={w} onClose={()=>setEditDay(null)} onSaved={()=>{onRefresh();setEditDay(null)}} tgId={tgId} tgName={tgName} cfg={cfg}/>}
    {payslip&&<PayslipModal w={w} month={month} year={year} onClose={()=>setPayslip(false)}/>}
  </div>
}

// ================================================================
// OWNER DASHBOARD
// ================================================================
function Meter({val,max,done,off}) {
  const pct = max>0 ? Math.min(100,val/max*100) : 0
  return <div style={{height:10,borderRadius:5,background:'rgba(23,23,23,.08)',overflow:'hidden'}}>
    <div style={{height:'100%',width:`${pct}%`,borderRadius:5,background:off?'rgba(23,23,23,.25)':done?C.green:C.yellow,transition:'width .5s cubic-bezier(.2,.8,.2,1)'}}/>
  </div>
}
function Goal({title,status,statusColor,val,max,done,off,note}) {
  return <div style={{display:'flex',flexDirection:'column',gap:7}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12}}>
      <div style={{fontSize:14,fontWeight:700,color:off?C.muted:C.ink}}>{title}</div>
      <div style={{fontSize:13,fontWeight:800,color:statusColor||C.ink,whiteSpace:'nowrap'}}>{status}</div>
    </div>
    {max>0&&<Meter val={val} max={max} done={done} off={off}/>}
    {note&&<div style={{fontSize:12,color:C.muted,lineHeight:1.4}}>{note}</div>}
  </div>
}
function ProgressCard({w}) {
  const dw = n => `${n} ${plural(n,'день','дні','днів')}`
  const wd = n => `${n} ${plural(n,'робочий день','робочі дні','робочих днів')}`
  const bonusDone = w.bonusActive
  const longDone  = w.bonusActive && w.longDays>=w.eLongNeed
  const premDone  = w.workDays>=w.ePremDays
  return <Card>
    <SecTitle>Прогрес до бонусів</SecTitle>
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <Goal title="Бонуси" off={w.bonusOff}
        status={w.bonusOff?'вимкнено':bonusDone?'відкриті':`ще ${dw(w.daysToBonus)}`} statusColor={w.bonusOff?C.muted:bonusDone?C.green:C.ink}
        val={w.workDays} max={w.eMinDays} done={bonusDone}
        note={`Відкриваються після ${wd(w.eMinDays)} за місяць, зараз ${w.workDays}. Неділі не рахуються.`}/>
      <Goal title={`Довгі дні від ${w.eLongHours} год`} off={w.bonusOff}
        status={w.bonusOff?'вимкнено':longDone?`+${fmt(w.bonusLong)} ₴`:w.longDays>=w.eLongNeed?'чекає на бонуси':`${w.longDays} з ${w.eLongNeed}`} statusColor={w.bonusOff?C.muted:longDone?C.green:C.ink}
        val={w.longDays} max={w.eLongNeed} done={longDone}
        note={`Коли таких днів буде ${w.eLongNeed}, кожен дає +${fmt(w.eLongBonus)} ₴. Зараз ${w.longDays}.`}/>
      <Goal title={`Премія ${fmt(w.ePremAmt)} ₴`} off={w.premiumOff}
        status={w.premiumOff?'вимкнено':premDone?`+${fmt(w.premium)} ₴`:`ще ${dw(w.daysToPremium)}`} statusColor={w.premiumOff?C.muted:premDone?C.green:C.ink}
        val={w.workDays} max={w.ePremDays} done={premDone}
        note={`Потрібно ${wd(w.ePremDays)} за місяць, зараз ${w.workDays}.`}/>
      <Goal title="Суботи" off={w.bonusOff}
        status={w.bonusOff?'вимкнено':`${w.saturdays} шт${w.bonusSat>0?` · +${fmt(w.bonusSat)} ₴`:''}`} statusColor={w.bonusOff?C.muted:w.bonusSat>0?C.green:C.ink}
        note={`+${fmt(w.eSatBonus)} ₴ за кожну суботу, коли бонуси відкриті.`}/>
    </div>
  </Card>
}

function PayHero({w,month}) {
  const receipt = [
    ['Нараховано', w.gross, false],
    ...(w.totalAdv>0?[['Аванси', -w.totalAdv, true]]:[]),
    ...(w.totalFines>0?[['Штрафи', -w.totalFines, true]]:[]),
    ...(w.debtPaid>0?[['Виплата боргу', -w.debtPaid, true]]:[]),
  ]
  return <div style={{position:'relative',overflow:'hidden',background:C.ink,borderRadius:28,padding:'20px 22px',color:'#fff'}}>
    <div className="hero-dot" style={{position:'absolute',right:-30,top:-30,width:120,height:120,borderRadius:'50%',background:C.yellow}}/>
    <div style={{position:'relative',fontSize:12,opacity:.7}}>До виплати · {MONTHS_UA[month]}</div>
    <div style={{position:'relative',fontSize:38,fontWeight:800,lineHeight:1.1,marginTop:4}}><Num value={w.final}/></div>
    <div style={{position:'relative',marginTop:14,paddingTop:12,borderTop:'1px solid rgba(255,255,255,.14)',display:'flex',flexDirection:'column',gap:5,fontSize:14}}>
      {receipt.map(([l,v,neg])=><div key={l} style={{display:'flex',justifyContent:'space-between',opacity:neg?.85:1}}>
        <span style={{opacity:.75}}>{l}</span><b style={{color:neg?'#ff8a80':'#fff'}}>{neg?'−':''}{fmt(Math.abs(v))} ₴</b>
      </div>)}
    </div>
  </div>
}

function PersonRow({w,i,onClick,watch}) {
  const ini = w.name.split(' ').slice(0,2).map(x=>x[0]||'').join('').toUpperCase()
  const late = watch&&w.daysSinceEntry>=2&&w.type==='shift'
  return <button onClick={()=>{vibrate('light');onClick()}} style={{'--i':Math.min(i,8),width:'100%',background:C.surface,border:late?`2px solid ${C.red}`:'none',borderRadius:22,padding:'12px 14px',cursor:'pointer',textAlign:'left',fontFamily:'inherit',display:'flex',alignItems:'center',gap:12,color:C.ink}}>
    <div style={{width:44,height:44,borderRadius:'50%',background:C.ink,color:C.yellow,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,flexShrink:0}}>{ini}</div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontWeight:800,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
      <div style={{fontSize:12.5,color:C.dim,marginTop:2}}>
        {w.type==='fixed'?(w.role||'Фіксована'):`${w.workDays} ${plural(w.workDays,'день','дні','днів')} · ${fmtH(w.totalHours)} год`}
        {w.totalFines>0&&<b style={{color:C.red}}> · штраф −{fmt(w.totalFines)}</b>}
        {w.debtRemaining>0&&<b style={{color:C.red}}> · борг {fmt(w.debtRemaining)}</b>}
      </div>
    </div>
    <div style={{fontWeight:800,fontSize:16}}>{fmt(w.final)}</div>
  </button>
}

function PersonSkeleton({n=5}) {
  return <div style={{display:'flex',flexDirection:'column',gap:10}}>
    {Array.from({length:n},(_,i)=><div key={i} style={{background:C.surface,borderRadius:22,padding:'12px 14px',display:'flex',alignItems:'center',gap:12}}>
      <Skel w={44} h={44} r={22}/>
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}><Skel h={14} w="55%"/><Skel h={11} w="35%"/></div>
      <Skel h={16} w={56}/>
    </div>)}
  </div>
}

function TopBars({items}) {
  const top = [...items].sort((a,b)=>(b.base+b.bonus)-(a.base+a.bonus)).slice(0,10)
  const max = Math.max(1,...top.map(x=>x.base+x.bonus))
  if (!top.length||top[0].base+top[0].bonus===0) return <div style={{color:C.muted,fontSize:13,padding:'8px 0'}}>Немає нарахувань за цей місяць</div>
  return <div>
    {top.map((x,i)=><div key={x.name+i} style={{display:'grid',gridTemplateColumns:'104px 1fr auto',gap:10,alignItems:'center',padding:'6px 0',fontSize:13}}>
      <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:600}}>{x.name}</span>
      <div style={{height:14,borderRadius:7,background:'rgba(23,23,23,0.06)',overflow:'hidden',display:'flex'}}>
        <div className="barx" style={{'--i':i,width:`${x.base/max*100}%`,background:C.ink}}/>
        <div className="barx" style={{'--i':i,width:`${x.bonus/max*100}%`,background:C.yellow}}/>
      </div>
      <b style={{minWidth:58,textAlign:'right'}}>{fmt(x.base+x.bonus)}</b>
    </div>)}
    <div style={{display:'flex',gap:14,marginTop:8,fontSize:12,color:C.dim}}>
      <span><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:C.ink,marginRight:6}}/>Ставка</span>
      <span><span style={{display:'inline-block',width:10,height:10,borderRadius:3,background:C.yellow,marginRight:6}}/>Бонуси</span>
    </div>
  </div>
}

function OwnerDashboard({workers,onRefresh,tgId,tgName,cfg,year,month,onMonthChange,loading,busy}) {
  const [view,   setView]   = useState('main')
  const [detail, setDetail] = useState(null)
  const [modal,  setModal]  = useState(null)
  const [search, setSearch] = useState('')
  const [tab,    setTab]    = useState('home')
  const [showIdle, setShowIdle] = useState(false)
  const [showLate, setShowLate] = useState(false)

  const totalFOP   = workers.reduce((s,w)=>s+(w.final||0),0)
  const totalGross = workers.reduce((s,w)=>s+(w.gross||0),0)
  const nowD = new Date()
  const isCurrent = year===nowD.getFullYear()&&month===nowD.getMonth()
  const alertWorkers = isCurrent ? workers.filter(w=>w.type==='shift'&&w.daysSinceEntry>=2) : []
  const totalFinesAll = workers.reduce((s,w)=>s+(w.totalFines||0),0)
  const totalDebt = workers.reduce((s,w)=>s+(w.debtRemaining||0),0)
  const q = search.trim().toLowerCase()
  const matches = q ? workers.filter(w=>w.name.toLowerCase().includes(q)) : workers
  const hasData = w => w.type==='fixed'||w.workDays>0||w.totalHours>0||w.gross>0||w.totalFines>0||w.totalAdv>0||w.debtRemaining>0
  const active = q ? matches : matches.filter(hasData)
  const idle   = q ? [] : matches.filter(w=>!hasData(w))

  const chart = workers.map(w=>({
    name:(()=>{const t=w.name.split(' ');return t[1]?`${t[0]} ${t[1][0]}.`:t[0]})(),
    base:(w.earnHours||0)+(w.earnPacks||0)||(w.type==='fixed'?w.gross:0),
    bonus:(w.bonusLong||0)+(w.bonusSat||0)+(w.premium||0)+(w.manualBonus||0),
  }))

  const refresh = ()=>onRefresh(year,month)
  const back = ()=>setView('main')
  if (view==='debts') return <DebtsView workers={workers} onBack={back} onRefresh={refresh} tgId={tgId} tgName={tgName}/>
  if (view==='fines') return <FinesView workers={workers} month={month} year={year} onBack={back} onRefresh={refresh} tgId={tgId} tgName={tgName}/>
  if (view==='shipments') return <ShipmentsView onBack={back} tgId={tgId} tgName={tgName} year={year} month={month} onMonthChange={onMonthChange}/>
  if (view==='intake') return <IntakeView onBack={back} tgId={tgId} tgName={tgName} year={year} month={month} onMonthChange={onMonthChange}/>
  if (view==='fuel') return <FuelView onBack={back} tgId={tgId} tgName={tgName} year={year} month={month} onMonthChange={onMonthChange} isOwner={true}/>
  if (view==='electricity') return <ElectricityView onBack={back} tgId={tgId} tgName={tgName} cfg={cfg}/>
  if (detail) return <WorkerDetail w={detail} allWorkers={workers} isOwner onBack={()=>setDetail(null)} onRefresh={()=>{setDetail(null);refresh()}} tgId={tgId} tgName={tgName} cfg={cfg} month={month} year={year}/>

  const personList = (list) => <div className="stagger" style={{display:'flex',flexDirection:'column',gap:10}}>
    {list.map((w,i)=><PersonRow key={w.tgId||w.name||i} w={w} i={i} watch={isCurrent} onClick={()=>setDetail(w)}/>)}
  </div>

  return <div style={{minHeight:'100vh',background:C.bg,paddingBottom:100}}>
    <TopBar title="ПилоРама" year={year} month={month} onMonth={onMonthChange} onRefresh={refresh} busy={busy} onSettings={()=>setModal('settings')}/>

    <div key={tab} className="view-in" style={{padding:'12px 16px 0',display:'flex',flexDirection:'column',gap:14}}>

      {tab==='home'&&<>
      {!loading&&alertWorkers.length>0&&<button className="fade-in" onClick={()=>{vibrate('light');setShowLate(v=>!v)}} style={{background:C.yellow,border:'none',borderRadius:20,padding:'14px 16px',color:C.ink,textAlign:'left',fontFamily:'inherit',cursor:'pointer',width:'100%'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,fontSize:14,fontWeight:800}}>
          <span>Не вносили 2+ дні: {alertWorkers.length}</span><Chevron open={showLate}/>
        </div>
        {showLate&&<div className="fade-in" style={{fontSize:13,fontWeight:600,marginTop:8,lineHeight:1.5}}>{alertWorkers.map(w=>w.name.split(' ').slice(0,2).join(' ')).join(', ')}</div>}
      </button>}

      <div style={{position:'relative',overflow:'hidden',background:C.ink,borderRadius:28,padding:'22px 22px 20px',color:'#fff'}}>
        <div className="hero-dot" style={{position:'absolute',right:-34,top:-34,width:130,height:130,borderRadius:'50%',background:C.yellow}}/>
        <div style={{position:'relative',fontSize:12,opacity:.7}}>До виплати · {MONTHS_UA[month]}</div>
        {loading
          ? <><Skel dark h={38} w={190} r={12} style={{marginTop:8}}/><Skel dark h={12} w={150} r={6} style={{marginTop:12}}/></>
          : <div className="fade-in">
              <div style={{position:'relative',fontSize:36,fontWeight:800,lineHeight:1.1,marginTop:4}}><Num value={totalFOP}/></div>
              <div style={{position:'relative',fontSize:13,opacity:.7,marginTop:6}}>Нараховано {fmt(totalGross)} ₴{totalFinesAll>0?` · штрафи −${fmt(totalFinesAll)} ₴`:''}</div>
            </div>}
      </div>

      <div className="stagger" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        <Tile i={0} n="clock" label="Зміна" primary onClick={()=>setModal('shift')}/>
        <Tile i={1} n="star" label="Премія" onClick={()=>setModal('bonus')}/>
        <Tile i={2} n="ban" label="Штраф" danger onClick={()=>setModal('fine')}/>
        <Tile i={3} n="card" label="Аванс" onClick={()=>setModal('advance')}/>
        <Tile i={4} n="box" label="Відправки" onClick={()=>setView('shipments')}/>
        <Tile i={5} n="tree" label="Сировина" onClick={()=>setView('intake')}/>
        <Tile i={6} n="fuel" label="Паливо" onClick={()=>setView('fuel')}/>
        <Tile i={7} n="bulb" label="Світло" onClick={()=>setView('electricity')}/>
        <Tile i={8} n="wallet" label="Борги" onClick={()=>setView('debts')}/>
        <Tile i={9} n="ban" label="Штрафи" onClick={()=>setView('fines')}/>
        <Tile i={10} n="user" label="Працівник" onClick={()=>setModal('addworker')}/>
      </div>
      </>}

      {tab==='reports'&&<>
      <div className="stagger" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Card style={{'--i':0}}><Lbl>Нараховано</Lbl><div style={{fontSize:21,fontWeight:800}}><Num value={totalGross}/></div></Card>
        <Card style={{'--i':1}}><Lbl>До виплати</Lbl><div style={{fontSize:21,fontWeight:800}}><Num value={totalFOP}/></div></Card>
        <Card style={{'--i':2}}><Lbl>Штрафи</Lbl><div style={{fontSize:21,fontWeight:800,color:totalFinesAll?C.red:C.ink}}><Num value={totalFinesAll}/></div></Card>
        <Card style={{'--i':3}}><Lbl>Борги</Lbl><div style={{fontSize:21,fontWeight:800,color:totalDebt?C.red:C.ink}}><Num value={totalDebt}/></div></Card>
      </div>
      <Card>
        <SecTitle>Нарахування · топ-10</SecTitle>
        {loading ? <PersonSkeleton n={4}/> : <TopBars items={chart}/>}
      </Card>
      <Card>
        <SecTitle>Години і виплати · {MONTHS_UA[month]}</SecTitle>
        {loading ? <Skel h={80}/> : workers.filter(hasData).map(w=><div key={w.tgId||w.name} style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:13,padding:'9px 0',borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontWeight:700}}>{w.name}</span>
          <span style={{color:C.dim,textAlign:'right'}}>{w.type==='shift'?`${fmtH(w.totalHours)} год · ${w.totalPacks||0} пач · `:''}<b style={{color:C.ink}}>{fmt(w.final)} ₴</b></span>
        </div>)}
      </Card>
      </>}

      {(tab==='people'||tab==='home')&&<>
      <div style={{fontSize:17,fontWeight:800,marginTop:4}}>Персонал</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Пошук за ім'ям..." style={{...inp,background:C.surface,border:'none',borderRadius:16,fontSize:15,padding:'14px 16px'}}/>
      {loading ? <PersonSkeleton/> : <>
        {personList(active)}
        {idle.length>0&&<button onClick={()=>{vibrate('light');setShowIdle(v=>!v)}} style={{background:'transparent',border:`1.5px dashed ${C.border}`,borderRadius:18,padding:'13px 16px',color:C.dim,fontFamily:'inherit',fontSize:14,fontWeight:700,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>Без записів цього місяця · {idle.length}</span><Chevron open={showIdle}/>
        </button>}
        {showIdle&&personList(idle)}
        {matches.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:16}}>Нікого не знайдено</div>}
      </>}
      </>}
    </div>

    <div className="navbar" style={{position:'fixed',left:'50%',bottom:14,background:C.ink,borderRadius:30,padding:6,display:'flex',gap:4,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,.25)'}}>
      {[['home','Головна','home'],['people','Персонал','user'],['reports','Звіти','chart']].map(([k,l,ic])=>
        <button key={k} onClick={()=>{vibrate('light');setTab(k)}} style={{background:tab===k?C.yellow:'transparent',color:tab===k?C.ink:'#fff',border:'none',borderRadius:24,padding:'8px 18px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:3,minWidth:84}}><Ico n={ic} s={20}/>{l}</button>)}
    </div>
    {modal==='advance'  &&<AdvanceForm worker={workers[0]||{}} allWorkers={workers} isOwner onClose={()=>setModal(null)} onSaved={refresh} tgId={tgId} tgName={tgName}/>}
    {modal==='shift'    &&<ShiftForm worker={workers[0]||{}} allWorkers={workers} isOwner onClose={()=>setModal(null)} onSaved={refresh} tgId={tgId} tgName={tgName} cfg={cfg}/>}
    {modal==='bonus'    &&<BonusForm worker={workers[0]||{}} allWorkers={workers} onClose={()=>setModal(null)} onSaved={refresh} tgId={tgId} tgName={tgName}/>}
    {modal==='fine'     &&<FineForm worker={workers[0]||{}} allWorkers={workers} onClose={()=>setModal(null)} onSaved={refresh} tgId={tgId} tgName={tgName}/>}
    {modal==='addworker'&&<AddWorkerForm onClose={()=>setModal(null)} onSaved={refresh} tgId={tgId} tgName={tgName}/>}
    {modal==='settings' &&<SettingsForm year={year} month={month} cfg={cfg} onClose={()=>setModal(null)} onSaved={refresh} tgId={tgId} tgName={tgName}/>}
  </div>
}

// ================================================================
// WORKER VIEW
// ================================================================
function WorkerView({tgId,data,onRefresh,loading,busy}) {
  const w = calcSalary(tgId, data)
  const cfg = data.cfg
  const [modal,         setModal]         = useState(null)
  const [year,          setYear]          = useState(new Date().getFullYear())
  const [month,         setMonth]         = useState(new Date().getMonth())
  const [showStats,     setShowStats]     = useState(false)
  const [showPayslip,   setShowPayslip]   = useState(false)
  const [workerEditDay, setWorkerEditDay] = useState(null)
  const [view,          setView]          = useState('main')
  const [motiv]                           = useState(randomMotiv())

  const onMonthChange = (y,m)=>{ setYear(y); setMonth(m); onRefresh(y,m) }

  if (view==='fuel') return <FuelView onBack={()=>setView('main')} tgId={tgId} tgName={w.name} year={year} month={month} onMonthChange={onMonthChange} isOwner={false}/>

  if (showStats) return <MonthlyStats tgId={tgId} name={w.name} onBack={()=>setShowStats(false)}/>


  const topBar = <TopBar title={w.name||'Мій кабінет'} year={year} month={month} onMonth={onMonthChange} onRefresh={()=>onRefresh(year,month)} busy={busy}/>

  if (loading) return <div style={{minHeight:'100vh',background:C.bg,paddingBottom:100}}>
    {topBar}
    <div style={{padding:'12px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <Skel h={170} r={28}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>{Array.from({length:4},(_,i)=><Skel key={i} h={84} r={20}/>)}</div>
      <Skel h={120} r={20}/><Skel h={160} r={20}/>
    </div>
  </div>

  return <div style={{minHeight:'100vh',background:C.bg,paddingBottom:100}}>
    {topBar}
    <div key={`${year}-${month}`} className="view-in" style={{padding:'12px 16px 0',display:'flex',flexDirection:'column',gap:14}}>

      <PayHero w={w} month={month}/>

      {w.fines?.length>0&&<div style={{background:`${C.red}11`,border:`2px solid ${C.red}`,borderRadius:20,padding:'14px 16px'}}>
        <div style={{fontSize:13,fontWeight:800,color:C.red,marginBottom:8}}>Штраф</div>
        {w.fines.map((f,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:13,padding:'4px 0'}}>
          <span style={{color:C.text}}>{f.reason||'Без причини'}<span style={{color:C.muted,fontSize:11.5}}> · {f.date}</span></span>
          <span style={{color:C.red,fontWeight:700,whiteSpace:'nowrap'}}>-{fmt(f.amount)} ₴</span>
        </div>)}
        {w.fines.length>1&&<div style={{borderTop:`1px solid ${C.red}33`,marginTop:6,paddingTop:6,display:'flex',justifyContent:'space-between',fontSize:12,color:C.red,fontWeight:700}}><span>Разом</span><span>-{fmt(w.totalFines)} ₴</span></div>}
        <div style={{fontSize:11.5,color:C.muted,marginTop:6}}>Віднімається від виплати</div>
      </div>}

      {/* Мотивація */}
      <div style={{background:'rgba(255,214,10,0.28)',borderRadius:16,padding:'12px 14px',fontSize:13,fontWeight:600,color:C.ink,textAlign:'center'}}>{motiv}</div>

      <Card>
        <SecTitle>МОЇ СТАВКИ</SecTitle>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:'rgba(23,23,23,0.05)',borderRadius:16,padding:'12px 14px'}}>
            <div style={{fontSize:11.5,color:C.muted,marginBottom:4}}>За годину</div>
            <div style={{fontSize:22,fontWeight:800,color:C.ink}}>{w.rateHour||'—'}</div>
            <div style={{fontSize:11.5,color:C.muted}}>грн</div>
          </div>
          <div style={{background:'rgba(255,214,10,0.28)',borderRadius:16,padding:'12px 14px'}}>
            <div style={{fontSize:11.5,color:C.muted,marginBottom:4}}>За пачку</div>
            <div style={{fontSize:22,fontWeight:800,color:C.ink}}>{w.ratePack||'—'}</div>
            <div style={{fontSize:11.5,color:C.muted}}>грн</div>
          </div>
        </div>
      </Card>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        <Tile i={0} n="clock" label="Зміна" primary onClick={()=>setModal('shift')}/>
        <Tile i={1} n="card" label="Аванс" onClick={()=>setModal('advance')}/>
        <Tile i={2} n="chart" label="Звіт" onClick={()=>setShowStats(true)}/>
        <Tile n="doc" label="Листок" onClick={()=>setShowPayslip(true)}/>
        {w.fuelAccess&&<Tile n="fuel" label="Внести паливо" wide onClick={()=>setView('fuel')}/>}
      </div>

      {(w.days||[]).length>0&&<Card>
        <SecTitle>Години по днях</SecTitle>
        <HoursChart w={w} year={year} month={month} cfg={cfg}/>
      </Card>}

      <ProgressCard w={w}/>

      <Card>
        <SecTitle>РОЗБИВКА</SecTitle>
        {w.lowRateApplied&&<div style={{fontSize:12,color:C.red,background:`${C.red}11`,borderRadius:8,padding:'6px 10px',marginBottom:8}}>
          Застосована знижена ставка: менше {w.lowRateDays} робочих днів за місяць
        </div>}
        <Row label={`Погодинно (${fmtH(w.totalHours)} × ${fmt(w.rateHour)} ₴)`} value={`${fmt(w.earnHours)} ₴`}/>
        <Row label={`Пачки (${w.totalPacks} × ${fmt(w.ratePack)} ₴)`} value={`${fmt(w.earnPacks)} ₴`}/>
        {w.bonusLong>0&&<Row label="Бонус 10+ год" value={`+${fmt(w.bonusLong)} ₴`} color={C.gold}/>}
        {w.bonusSat>0&&<Row label="Бонус суботи" value={`+${fmt(w.bonusSat)} ₴`} color={C.gold}/>}
        {w.premium>0&&<Row label="Премія" value={`+${fmt(w.premium)} ₴`} color={C.green}/>}
        {w.manualBonus>0&&<Row label="Ручні премії" value={`+${fmt(w.manualBonus)} ₴`} color={C.green}/>}
        <Row label="Нараховано" value={`${fmt(w.gross)} ₴`} bold/>
        {w.totalAdv>0&&<Row label="Аванси" value={`-${fmt(w.totalAdv)} ₴`} color={C.red}/>}
        {w.totalFines>0&&<Row label="Штрафи" value={`-${fmt(w.totalFines)} ₴`} color={C.red}/>}
        {w.debtPaid>0&&<Row label="Виплата боргу" value={`-${fmt(w.debtPaid)} ₴`} color={C.red}/>}
        <div style={{display:'flex',justifyContent:'space-between',paddingTop:12}}>
          <span style={{color:C.muted,fontSize:12}}>ДО ВИПЛАТИ</span>
          <span style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(w.final)} ₴</span>
        </div>
        {w.debtRemaining>0&&<div style={{marginTop:10,padding:'10px 14px',background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:8}}>
          <div style={{fontSize:12,color:C.red,marginBottom:6}}>Залишок боргу: {fmt(w.debtRemaining)} ₴</div>
          {w.debtPaid>0&&<Prog val={w.debtPaid} max={w.debtRemaining+w.debtPaid} color={C.green}/>}
          {w.debtPaid>0&&<div style={{fontSize:11.5,color:C.muted,marginTop:4}}>Погашено: {fmt(w.debtPaid)} ₴</div>}
        </div>}
      </Card>

      {w.days?.length>0&&<Card>
        <SecTitle>МОЇ ДНІ</SecTitle>
        <DaysExpand days={w.days} rateHour={w.rateHour} ratePack={w.ratePack} longDayHours={cfg?.longDayHours} isOwner={true} onEdit={setWorkerEditDay}/>
      </Card>}
    </div>

    <div style={{position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:14,background:C.ink,borderRadius:30,padding:6,display:'flex',gap:4,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,.25)'}}>
      {[['home','Головна','home',()=>window.scrollTo({top:0,behavior:'smooth'})],['stats','Звіт','chart',()=>setShowStats(true)],['slip','Листок','doc',()=>setShowPayslip(true)]].map(([k,l,ic,fn])=>
        <button key={k} onClick={fn} style={{background:k==='home'?C.yellow:'transparent',color:k==='home'?C.ink:'#fff',border:'none',borderRadius:24,padding:'8px 18px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}><Ico n={ic} s={20}/>{l}</button>)}
    </div>
    {modal==='shift'  &&<ShiftForm worker={w} allWorkers={[w]} isOwner={false} onClose={()=>setModal(null)} onSaved={()=>onRefresh(year,month)} tgId={tgId} tgName={w.name} cfg={cfg}/>}
    {modal==='advance'&&<AdvanceForm worker={w} allWorkers={[w]} isOwner={false} onClose={()=>setModal(null)} onSaved={()=>onRefresh(year,month)} tgId={tgId} tgName={w.name}/>}
    {workerEditDay&&<EditDayForm day={workerEditDay} worker={w} onClose={()=>setWorkerEditDay(null)} onSaved={()=>{onRefresh(year,month);setWorkerEditDay(null)}} tgId={tgId} tgName={w.name} cfg={cfg}/>}
    {showPayslip&&<PayslipModal w={w} month={month} year={year} onClose={()=>setShowPayslip(false)}/>}
  </div>
}

// ================================================================
// MAIN APP
// ================================================================
const monthKeyOf = (y,m) => `${y}-${m}`
const MONTH_TTL = 15000   // свіжість кешу місяця (мс): всередині — не перезавантажуємо при перемиканні
const sleep = ms => new Promise(r=>setTimeout(r,ms))

export default function App() {
  const [state,   setState]   = useState('loading')
  const [error,   setError]   = useState(null)
  const [shared,  setShared]  = useState(null)
  const [md,      setMd]      = useState(EMPTY_MONTH)
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [busy,    setBusy]    = useState(0)
  const [toast,   setToast]   = useState('')
  const [tgId,    setTgId]    = useState(null)
  const [tgName,  setTgName]  = useState('')
  const [year,    setYear]    = useState(new Date().getFullYear())
  const [month,   setMonth]   = useState(new Date().getMonth())

  const cache = useRef(new Map())                       // 'рік-місяць' → { md, at }
  const sel   = useRef({ y:new Date().getFullYear(), m:new Date().getMonth() })
  const alive = useRef(true)
  useEffect(()=>()=>{ alive.current = false },[])

  const showToast = useCallback(t=>{ setToast(t); setTimeout(()=>setToast(''),3200) },[])

  // Дані для вибраного місяця: спільні (персонал, борги, налаштування) + помісячні
  const data    = useMemo(()=> shared ? assembleData(shared, md, year, month) : null, [shared, md, year, month])
  const workers = useMemo(()=> data && state==='owner' ? calcAllWorkers(data) : [], [data, state])

  const fetchMonthInto = useCallback(async (y,m)=>{
    const md2 = await fetchMonthData(y,m)
    cache.current.set(monthKeyOf(y,m), { md:md2, at:Date.now() })
    if (alive.current && sel.current.y===y && sel.current.m===m) { setMd(md2); setLoadingMonth(false) }
    return md2
  },[])

  // Вибір місяця: з кешу — миттєво, інакше скелетон; у фоні тихо оновлюємо
  const selectMonth = useCallback(async (y,m)=>{
    sel.current = { y, m }; setYear(y); setMonth(m)
    const hit = cache.current.get(monthKeyOf(y,m))
    if (hit) { setMd(hit.md); setLoadingMonth(false) }
    else     { setMd(EMPTY_MONTH); setLoadingMonth(true) }
    if (hit && Date.now()-hit.at < MONTH_TTL) return
    setBusy(b=>b+1)
    try { await fetchMonthInto(y,m) }
    catch(e) {
      if (!hit) { setLoadingMonth(false); showToast('Не вдалося завантажити місяць. Перевір інтернет і спробуй ще раз') }
    }
    finally { setBusy(b=>b-1) }
  },[fetchMonthInto, showToast])

  // Оновлення: спільні дані + поточний місяць
  const refresh = useCallback(async (y,m)=>{
    if (y!==undefined && m!==undefined && (y!==sel.current.y || m!==sel.current.m)) return selectMonth(y,m)
    const { y:cy, m:cm } = sel.current
    setBusy(b=>b+1)
    try {
      const [sh, md2] = await Promise.all([fetchShared(), fetchMonthData(cy,cm)])
      cache.current.set(monthKeyOf(cy,cm), { md:md2, at:Date.now() })
      if (!alive.current) return
      setShared(sh)
      if (sel.current.y===cy && sel.current.m===cm) { setMd(md2); setLoadingMonth(false) }
    } catch(e) { showToast('Не вдалося оновити дані. Спробуй ще раз') }
    finally { setBusy(b=>b-1) }
  },[selectMonth, showToast])

  // Фонове підвантаження попередніх місяців, щоб перемикання було миттєвим
  const prefetch = useCallback(async (y,m)=>{
    for (let i=1;i<=5;i++) {
      await sleep(700)
      if (!alive.current) return
      const d = new Date(y, m-i), yy = d.getFullYear(), mm = d.getMonth()
      if (cache.current.has(monthKeyOf(yy,mm))) continue
      try { const md2 = await fetchMonthData(yy,mm); cache.current.set(monthKeyOf(yy,mm), { md:md2, at:Date.now() }) } catch(e){}
    }
  },[])

  const load = useCallback(async ()=>{
    try {
      setState('loading'); setError(null)
      const tg = window.Telegram?.WebApp
      tg?.ready(); tg?.expand()
      tg?.setHeaderColor?.('#efeee9')
      tg?.setBackgroundColor?.('#efeee9')
      tg?.setBottomBarColor?.('#efeee9')

      const uid   = tg?.initDataUnsafe?.user?.id || null
      const uname = tg?.initDataUnsafe?.user?.first_name || ''
      setTgId(uid); setTgName(uname)
      const owner = OWNER_IDS.includes(uid)

      const now = new Date(), yr = now.getFullYear(), mo = now.getMonth()
      sel.current = { y:yr, m:mo }; setYear(yr); setMonth(mo)

      const [sh, md0] = await Promise.all([fetchShared(), fetchMonthData(yr,mo)])
      cache.current.set(monthKeyOf(yr,mo), { md:md0, at:Date.now() })
      setShared(sh); setMd(md0); setLoadingMonth(false)

      if (owner) setState('owner')
      else {
        const acc = await checkAccess(uid)
        setState(acc.allowed ? 'worker' : 'denied')
      }
      prefetch(yr, mo)
    } catch(e) { setError(e.message); setState('error') }
  },[prefetch])

  useEffect(()=>{ load() },[])

  const handleMonthChange = selectMonth

  if (state==='loading') return <AppSkeleton/>

  if (state==='error') return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:24}}>
      <div style={{fontSize:36}}>⚠️</div>
      <div style={{color:C.red,fontSize:14,fontWeight:700}}>Помилка підключення</div>
      <div style={{color:C.dim,fontSize:12,textAlign:'center',maxWidth:300,lineHeight:1.6}}>{error}</div>
      <button onClick={()=>load()} style={{background:C.yellow,color:C.ink,border:'none',borderRadius:8,padding:'10px 24px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>Спробувати знову</button>
    </div>
  )

  if (state==='denied') return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:24}}>
      <div style={{fontSize:48}}>🔒</div>
      <div style={{color:C.red,fontSize:15,fontWeight:700}}>Доступ закрито</div>
      <div style={{color:C.dim,fontSize:13,textAlign:'center',maxWidth:280,lineHeight:1.7}}>Тебе ще не додано до системи.<br/>Зверніться до власника.</div>
      {tgId&&<div style={{background:'rgba(23,23,23,0.06)',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 16px',fontSize:12,color:C.muted,textAlign:'center'}}>
        Твій Telegram ID:<br/><span style={{color:C.accent,fontSize:15,fontWeight:700}}>{tgId}</span><br/>
        <span style={{fontSize:11.5}}>(надішли власнику)</span>
      </div>}
    </div>
  )

  if (state==='owner')  return <><OwnerDashboard workers={workers} onRefresh={refresh} tgId={tgId} tgName={tgName} cfg={data?.cfg||DEFAULT_CFG} year={year} month={month} onMonthChange={handleMonthChange} loading={loadingMonth} busy={busy>0}/><Toast text={toast}/></>
  if (state==='worker') return <><WorkerView tgId={tgId} data={data} onRefresh={refresh} loading={loadingMonth} busy={busy>0}/><Toast text={toast}/></>
  return null
}
