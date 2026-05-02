import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getTodaysBirthdays, getSettings, sendBirthdayEmail } from '../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Confetti — massive burst, multi-shape, physics-based
// ─────────────────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  '#f472b6','#e879f9','#a78bfa','#818cf8','#4f86f7',
  '#34d399','#fbbf24','#fb923c','#f87171','#38bdf8',
  '#4ade80','#f9a8d4','#c084fc','#67e8f9','#fde68a',
]

function Confetti({ run }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    if (!run) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    class Particle {
      constructor(initial) {
        this.x     = Math.random() * canvas.width
        this.y     = initial ? -20 - Math.random() * canvas.height * 0.6 : -20
        this.vx    = (Math.random() - 0.5) * 6
        this.vy    = 1.5 + Math.random() * 4
        this.grav  = 0.05 + Math.random() * 0.04
        this.rot   = Math.random() * Math.PI * 2
        this.rotV  = (Math.random() - 0.5) * 0.16
        this.osc   = Math.random() * 0.05
        this.oscX  = Math.random() * Math.PI * 2
        this.size  = 5 + Math.random() * 11
        this.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
        this.shape = Math.random() < 0.5 ? 'rect' : Math.random() < 0.6 ? 'circle' : 'star'
        this.alpha = 1
      }
      step(elapsed, total) {
        this.vy += this.grav; this.oscX += this.osc
        this.x += this.vx + Math.sin(this.oscX) * 2
        this.y += this.vy; this.rot += this.rotV
        const fadeAt = total * 0.6
        if (elapsed > fadeAt) this.alpha = Math.max(0, 1 - (elapsed - fadeAt) / (total * 0.4))
      }
      draw(ctx) {
        ctx.save(); ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color
        ctx.translate(this.x, this.y); ctx.rotate(this.rot)
        if (this.shape === 'rect') {
          ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2)
        } else if (this.shape === 'circle') {
          ctx.beginPath(); ctx.arc(0, 0, this.size / 2.2, 0, Math.PI * 2); ctx.fill()
        } else {
          ctx.beginPath()
          for (let i = 0; i < 5; i++) {
            const a = (i * 4 * Math.PI / 5) - Math.PI / 2
            const b = a + (2 * Math.PI / 5)
            const o = this.size / 2, in_ = o * 0.42
            if (i === 0) ctx.moveTo(Math.cos(a)*o, Math.sin(a)*o); else ctx.lineTo(Math.cos(a)*o, Math.sin(a)*o)
            ctx.lineTo(Math.cos(b)*in_, Math.sin(b)*in_)
          }
          ctx.closePath(); ctx.fill()
        }
        ctx.restore()
      }
    }

    const DURATION  = 7500
    const particles = Array.from({ length: 280 }, (_, i) => new Particle(true))
    const start     = Date.now()

    const loop = () => {
      const elapsed = Date.now() - start
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let any = false
      particles.forEach(p => {
        if (p.y < canvas.height + 30) { any = true; p.step(elapsed, DURATION); p.draw(ctx) }
        if (p.y > canvas.height + 20 && elapsed < DURATION * 0.55) Object.assign(p, new Particle(false))
      })
      if (any || elapsed < DURATION) rafRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize) }
  }, [run])

  if (!run) return null
  return (
    <canvas ref={canvasRef} style={{ position:'fixed', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:10000 }} />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating emoji particles inside the modal
// ─────────────────────────────────────────────────────────────────────────────
const FLOAT_EMOJIS = ['✨','⭐','🌟','💫','🎊','🎈','🎉','💜','💙','🎀','🌙','❤️']

function FloatingParticles() {
  const particles = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    id: i,
    emoji: FLOAT_EMOJIS[i % FLOAT_EMOJIS.length],
    left: 3 + (i * 4.2) % 94,
    duration: 4 + (i * 0.37) % 5,
    delay: (i * 0.28) % 4,
    size: 13 + (i * 3) % 14,
  })), [])

  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      {particles.map(p => (
        <motion.div key={p.id}
          style={{ position:'absolute', left:`${p.left}%`, bottom:-20, fontSize:p.size, userSelect:'none', lineHeight:1 }}
          animate={{ y:[0,-480], opacity:[0, 0.9, 0.9, 0], rotate:[-12,12] }}
          transition={{ duration:p.duration, delay:p.delay, repeat:Infinity, ease:'easeInOut' }}
        >{p.emoji}</motion.div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Birthday modal — for the birthday person
// ─────────────────────────────────────────────────────────────────────────────
const stagger = (i) => ({ initial:{ opacity:0, y:24 }, animate:{ opacity:1, y:0 }, transition:{ delay: 0.2 + i*0.12, type:'spring', damping:22, stiffness:220 } })

function BirthdaySelfModal({ user, onClose }) {
  const firstName = user.full_name?.split(' ')[0] || user.full_name

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:'fixed', inset:0, zIndex:9998, display:'flex', alignItems:'center', justifyContent:'center',
        background:'rgba(2,1,10,0.88)', backdropFilter:'blur(20px)', padding:16 }}
    >
      <FloatingParticles />

      <motion.div
        initial={{ scale:0.55, opacity:0, y:100 }}
        animate={{ scale:1,    opacity:1, y:0 }}
        exit={{   scale:0.9,   opacity:0, y:40 }}
        transition={{ type:'spring', damping:16, stiffness:160, delay:0.05 }}
        style={{
          position:'relative', width:'100%', maxWidth:460, zIndex:1,
          background:'linear-gradient(150deg,#0c0520 0%,#14082e 40%,#0a0618 100%)',
          border:'1px solid rgba(244,114,182,0.3)',
          borderRadius:28, overflow:'hidden',
          boxShadow:'0 0 60px rgba(244,114,182,0.2), 0 0 120px rgba(79,134,247,0.12), inset 0 1px 0 rgba(255,255,255,0.07), 0 40px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* Rainbow shimmer strip */}
        <div style={{ height:4, background:'linear-gradient(90deg,#f472b6,#e879f9,#a78bfa,#4f86f7,#34d399,#fbbf24,#f87171,#f472b6)', backgroundSize:'300% 100%', animation:'bd-shimmer 3s linear infinite' }} />

        <div style={{ padding:'36px 36px 32px', textAlign:'center', position:'relative' }}>

          {/* Cake with sparkle ring */}
          <motion.div {...stagger(0)} style={{ display:'inline-block', position:'relative', marginBottom:14 }}>
            <motion.div
              animate={{ y:[0,-10,0] }}
              transition={{ duration:2.5, repeat:Infinity, ease:'easeInOut' }}
              style={{ fontSize:68, lineHeight:1, display:'inline-block', filter:'drop-shadow(0 0 28px rgba(251,191,36,0.6))' }}
            >🎂</motion.div>
            {/* Orbiting sparkle */}
            <motion.div
              animate={{ rotate:360 }}
              transition={{ duration:4, repeat:Infinity, ease:'linear' }}
              style={{ position:'absolute', inset:-12, borderRadius:'50%', border:'2px dashed rgba(251,191,36,0.25)' }}
            >
              <div style={{ position:'absolute', top:-6, left:'50%', transform:'translateX(-50%)', fontSize:12 }}>✨</div>
            </motion.div>
          </motion.div>

          {/* Emoji row */}
          <motion.div {...stagger(1)} style={{ fontSize:18, letterSpacing:7, marginBottom:18, opacity:0.9 }}>
            🎊&nbsp;🌟&nbsp;🎉&nbsp;🎈&nbsp;🎀
          </motion.div>

          {/* HAPPY BIRTHDAY */}
          <motion.h1 {...stagger(2)} style={{
            fontSize:38, fontWeight:900, letterSpacing:-1.5, lineHeight:1.05, marginBottom:8,
            background:'linear-gradient(135deg,#fda4d4 0%,#f472b6 30%,#c084fc 60%,#818cf8 85%,#60a5fa 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
          }}>Happy Birthday!</motion.h1>

          {/* Name — big and gold */}
          <motion.div {...stagger(3)} style={{ marginBottom:22 }}>
            <span style={{ fontSize:30, fontWeight:900, color:'#fbbf24', letterSpacing:-0.5,
              textShadow:'0 0 30px rgba(251,191,36,0.5), 0 0 60px rgba(251,191,36,0.2)' }}>
              {firstName}
            </span>
            <span style={{ fontSize:24, marginLeft:8 }}>🌟</span>
          </motion.div>

          {/* Message */}
          <motion.div {...stagger(4)} style={{
            background:'linear-gradient(135deg,rgba(244,114,182,0.08) 0%,rgba(99,102,241,0.08) 100%)',
            border:'1px solid rgba(244,114,182,0.2)', borderRadius:16,
            padding:'18px 20px', marginBottom:18, textAlign:'left',
          }}>
            <p style={{ color:'#e2e8f0', fontSize:13.5, lineHeight:1.8, margin:0 }}>
              Today the universe made a brilliant decision — it gave us{' '}
              <strong style={{ color:'#f9a8d4' }}>{firstName}</strong>. You show up, you deliver,
              you make this place worth coming to every single day. That's not ordinary —
              that's <strong style={{ color:'#c084fc' }}>extraordinary</strong>. Today is entirely yours. 🚀
            </p>
          </motion.div>

          {/* Quote */}
          <motion.p {...stagger(5)} style={{ color:'#6d28d9', fontSize:12, fontStyle:'italic', marginBottom:24, lineHeight:1.65 }}>
            "May this year bring you everything you deserve — which is absolutely everything."
          </motion.p>

          {/* CTA button */}
          <motion.div {...stagger(6)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
            <motion.button
              onClick={onClose}
              whileHover={{ scale:1.05, boxShadow:'0 8px 40px rgba(244,114,182,0.6)' }}
              whileTap={{ scale:0.97 }}
              style={{
                background:'linear-gradient(135deg,#f472b6 0%,#a78bfa 50%,#4f86f7 100%)',
                border:'none', borderRadius:16, padding:'13px 32px',
                color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer',
                boxShadow:'0 4px 24px rgba(244,114,182,0.4)', letterSpacing:0.3,
              }}
            >
              🎉&nbsp;&nbsp;Let's Make It Legendary!
            </motion.button>
            <button
              onClick={onClose}
              style={{ background:'none', border:'none', color:'#4b2d7a', fontSize:11, cursor:'pointer', letterSpacing:0.3, padding:'2px 8px' }}
            >
              Don't show again today
            </button>
          </motion.div>
        </div>

        {/* Bottom glow line */}
        <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(167,139,250,0.4),transparent)' }} />
        <div style={{ padding:'10px 24px', textAlign:'center' }}>
          <p style={{ color:'#3b1e6e', fontSize:11, margin:0 }}>From everyone at WorkTrack Pro 💜</p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Banners for other employees
// ─────────────────────────────────────────────────────────────────────────────
function BirthdayBanners({ birthdays, onDismiss }) {
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:9997, display:'flex', flexDirection:'column', gap:10, maxWidth:310, width:'100%' }}>
      <AnimatePresence>
        {birthdays.map((person, i) => (
          <motion.div key={person.id}
            initial={{ opacity:0, x:80, scale:0.88 }}
            animate={{ opacity:1, x:0,  scale:1 }}
            exit={{   opacity:0, x:80, scale:0.88 }}
            transition={{ type:'spring', damping:20, stiffness:200, delay:i*0.12 }}
            style={{
              background:'linear-gradient(135deg,rgba(18,10,40,0.97) 0%,rgba(12,8,28,0.97) 100%)',
              border:'1px solid rgba(167,139,250,0.35)', borderRadius:18,
              padding:'13px 15px', display:'flex', alignItems:'center', gap:12,
              boxShadow:'0 8px 32px rgba(167,139,250,0.15)',
              position:'relative', overflow:'hidden',
            }}
          >
            <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'linear-gradient(180deg,#f472b6,#a78bfa)', borderRadius:'18px 0 0 18px' }} />
            <div style={{ fontSize:30, flexShrink:0, filter:'drop-shadow(0 0 6px rgba(251,191,36,0.4))' }}>🎂</div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ color:'#f3f4f6', fontWeight:700, fontSize:13, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                🎉 {person.full_name.split(' ')[0]}'s Birthday!
              </p>
              <p style={{ color:'#94a3b8', fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {person.full_name}{person.department ? ` · ${person.department}` : ''}
              </p>
            </div>
            <button onClick={() => onDismiss(person.id)}
              style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#64748b', cursor:'pointer', fontSize:13, padding:'4px 7px', flexShrink:0 }}>
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BirthdayManager — orchestrates everything
// ─────────────────────────────────────────────────────────────────────────────
export function BirthdayManager({ user }) {
  const [confetti,       setConfetti      ] = useState(false)
  const [selfModal,      setSelfModal     ] = useState(false)
  const [otherBirthdays, setOtherBirthdays] = useState([])
  const [dismissed,      setDismissed     ] = useState(new Set())

  useEffect(() => {
    if (!user?.id) return
    const today    = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
    const modalKey = `wt-bday-modal-${today}`

    getTodaysBirthdays().then(async people => {
      const isMyBday = people.some(p => p.id === user.id)
      setOtherBirthdays(people.filter(p => p.id !== user.id))

      if (isMyBday) {
        // Only show modal + confetti if not already dismissed today
        if (!localStorage.getItem(modalKey)) {
          setConfetti(true)
          setSelfModal(true)
        }
        // Email still fires once regardless (separate key)
        const emailKey = `wt-bday-email-${today}`
        if (!localStorage.getItem(emailKey)) {
          localStorage.setItem(emailKey, '1')
          const me = people.find(p => p.id === user.id)
          getSettings().then(s => sendBirthdayEmail(me, s)).catch(() => {})
        }
      }
    }).catch(() => {})
  }, [user?.id])

  function handleModalClose() {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
    localStorage.setItem(`wt-bday-modal-${today}`, '1')
    setSelfModal(false)
  }

  const visibleBanners = otherBirthdays.filter(p => !dismissed.has(p.id))
  const dismiss = useCallback(id => setDismissed(s => new Set([...s, id])), [])

  return (
    <>
      <Confetti run={confetti} />
      <AnimatePresence>
        {selfModal && <BirthdaySelfModal user={user} onClose={handleModalClose} />}
      </AnimatePresence>
      {visibleBanners.length > 0 && <BirthdayBanners birthdays={visibleBanners} onDismiss={dismiss} />}
    </>
  )
}
