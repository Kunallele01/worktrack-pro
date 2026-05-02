import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getTodaysBirthdays, getSettings, sendBirthdayEmail } from '../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Confetti — canvas-based, multi-shape particles with physics
// ─────────────────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  '#f472b6','#e879f9','#a78bfa','#818cf8','#4f86f7',
  '#34d399','#fbbf24','#fb923c','#f87171','#38bdf8','#4ade80',
]

function Confetti({ run }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    if (!run) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    class Particle {
      constructor(initial) {
        this.x     = Math.random() * canvas.width
        this.y     = initial ? -20 - Math.random() * canvas.height * 0.5 : -20
        this.vx    = (Math.random() - 0.5) * 5
        this.vy    = 1.8 + Math.random() * 3.5
        this.grav  = 0.055 + Math.random() * 0.035
        this.rot   = Math.random() * Math.PI * 2
        this.rotV  = (Math.random() - 0.5) * 0.14
        this.osc   = Math.random() * 0.045
        this.oscX  = Math.random() * Math.PI * 2
        this.size  = 5 + Math.random() * 9
        this.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
        this.shape = Math.random() < 0.55 ? 'rect' : Math.random() < 0.6 ? 'circle' : 'star'
        this.alpha = 1
      }

      step(elapsed, total) {
        this.vy   += this.grav
        this.oscX += this.osc
        this.x    += this.vx + Math.sin(this.oscX) * 1.8
        this.y    += this.vy
        this.rot  += this.rotV
        const fadeAt = total * 0.62
        if (elapsed > fadeAt) this.alpha = Math.max(0, 1 - (elapsed - fadeAt) / (total * 0.38))
      }

      draw(ctx) {
        ctx.save()
        ctx.globalAlpha = this.alpha
        ctx.fillStyle   = this.color
        ctx.translate(this.x, this.y)
        ctx.rotate(this.rot)
        if (this.shape === 'rect') {
          ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2)
        } else if (this.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, this.size / 2.2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // 5-point star
          ctx.beginPath()
          for (let i = 0; i < 5; i++) {
            const a  = (i * 4 * Math.PI / 5) - Math.PI / 2
            const ai = a + (2 * Math.PI / 5)
            const or = this.size / 2
            const ir = or * 0.42
            if (i === 0) ctx.moveTo(Math.cos(a) * or, Math.sin(a) * or)
            else         ctx.lineTo(Math.cos(a) * or, Math.sin(a) * or)
            ctx.lineTo(Math.cos(ai) * ir, Math.sin(ai) * ir)
          }
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }
    }

    const DURATION = 6500
    const particles = Array.from({ length: 220 }, (_, i) => new Particle(true))
    const start     = Date.now()

    const loop = () => {
      const elapsed = Date.now() - start
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let any = false
      particles.forEach(p => {
        if (p.y < canvas.height + 30) {
          any = true
          p.step(elapsed, DURATION)
          p.draw(ctx)
          if (p.y > canvas.height + 20 && elapsed < DURATION * 0.5) {
            // Reset particle to top — keeps the burst going
            Object.assign(p, new Particle(false))
          }
        }
      })

      if (any || elapsed < DURATION) rafRef.current = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [run])

  if (!run) return null
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 10000,
      }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Birthday Modal — shown to the birthday person
// ─────────────────────────────────────────────────────────────────────────────
function BirthdaySelfModal({ user, onClose }) {
  const firstName = user.full_name?.split(' ')[0] || user.full_name

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(16px)',
        padding: 16,
      }}
    >
      {/* Ambient glow orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', top:'5%', left:'10%', background:'radial-gradient(circle,rgba(244,114,182,0.22) 0%,transparent 70%)', animation:'bd-float 7s ease-in-out infinite' }} />
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', bottom:'10%', right:'15%', background:'radial-gradient(circle,rgba(79,134,247,0.22) 0%,transparent 70%)', animation:'bd-float 9s ease-in-out infinite 2s' }} />
        <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', top:'45%', right:'30%', background:'radial-gradient(circle,rgba(167,139,250,0.2) 0%,transparent 70%)', animation:'bd-float 8s ease-in-out infinite 1s' }} />
      </div>

      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 80 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        transition={{ type: 'spring', damping: 18, stiffness: 180, delay: 0.05 }}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          background: 'linear-gradient(145deg, rgba(12,8,35,0.98) 0%, rgba(28,18,60,0.98) 50%, rgba(10,8,30,0.98) 100%)',
          border: '1px solid rgba(244,114,182,0.25)',
          borderRadius: 26,
          overflow: 'hidden',
          boxShadow: '0 0 100px rgba(244,114,182,0.18), 0 0 200px rgba(79,134,247,0.1), 0 40px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Rainbow top border */}
        <div style={{
          height: 5,
          background: 'linear-gradient(90deg,#f472b6,#e879f9,#a78bfa,#4f86f7,#34d399,#fbbf24,#f472b6)',
          backgroundSize: '300% 100%',
          animation: 'bd-shimmer 4s linear infinite',
        }} />

        {/* Inner glow accents */}
        <div style={{ position:'absolute', top:-80, left:-80, width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(244,114,182,0.14) 0%,transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(79,134,247,0.14) 0%,transparent 70%)', pointerEvents:'none' }} />

        <div style={{ padding: '44px 40px 36px', textAlign: 'center' }}>
          {/* Cake */}
          <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 16, display:'inline-block', animation:'bd-float 3s ease-in-out infinite', filter:'drop-shadow(0 0 24px rgba(251,191,36,0.5))' }}>
            🎂
          </div>

          {/* Decoration row */}
          <div style={{ fontSize: 22, letterSpacing: 8, marginBottom: 20, opacity: 0.9 }}>
            🎊&nbsp;🌟&nbsp;🎉&nbsp;✨&nbsp;🎈
          </div>

          {/* Main heading */}
          <h1 style={{
            fontSize: 42, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1.05,
            background: 'linear-gradient(135deg, #f9a8d4 0%, #f472b6 35%, #c084fc 65%, #818cf8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            marginBottom: 12,
          }}>
            Happy Birthday!
          </h1>

          {/* Name */}
          <p style={{ fontSize: 28, fontWeight: 800, color: '#fbbf24', marginBottom: 24, textShadow: '0 0 30px rgba(251,191,36,0.35)' }}>
            {firstName} &nbsp;⭐
          </p>

          {/* Message */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(244,114,182,0.07) 0%, rgba(167,139,250,0.07) 100%)',
            border: '1px solid rgba(244,114,182,0.18)',
            borderRadius: 16, padding: '20px 22px', marginBottom: 24, textAlign: 'left',
          }}>
            <p style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.75, margin: 0 }}>
              Your whole team is pausing today to celebrate{' '}
              <strong style={{ color: '#f472b6' }}>you</strong>.
              You show up every day, deliver without fail, and make this place better by being here.
              Today belongs entirely to you — make it unforgettable. 🚀
            </p>
          </div>

          {/* Quote */}
          <p style={{ color: '#7c3aed', fontSize: 12, fontStyle: 'italic', marginBottom: 28, lineHeight: 1.6 }}>
            "May this year bring you everything you deserve — which is absolutely everything."
          </p>

          {/* Button */}
          <button
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #f472b6 0%, #a78bfa 55%, #4f86f7 100%)',
              border: 'none', borderRadius: 16, padding: '14px 36px',
              color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
              boxShadow: '0 6px 28px rgba(244,114,182,0.4), 0 2px 8px rgba(0,0,0,0.4)',
              letterSpacing: 0.3, transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 8px 36px rgba(244,114,182,0.55)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 6px 28px rgba(244,114,182,0.4), 0 2px 8px rgba(0,0,0,0.4)' }}
          >
            🎉&nbsp;&nbsp;Let's Make It Legendary!
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Birthday banners — shown to everyone else when a teammate has a birthday
// ─────────────────────────────────────────────────────────────────────────────
function BirthdayBanners({ birthdays, onDismiss }) {
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9997,
      display: 'flex', flexDirection: 'column', gap: 10,
      maxWidth: 320, width: '100%',
    }}>
      <AnimatePresence>
        {birthdays.map((person, i) => (
          <motion.div
            key={person.id}
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.9 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200, delay: i * 0.12 }}
            style={{
              background: 'linear-gradient(135deg, rgba(22,15,50,0.97) 0%, rgba(16,12,38,0.97) 100%)',
              border: '1px solid rgba(167,139,250,0.35)',
              borderRadius: 18,
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: '0 8px 32px rgba(167,139,250,0.15), 0 2px 8px rgba(0,0,0,0.5)',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Left glow accent */}
            <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'linear-gradient(180deg,#f472b6,#a78bfa)', borderRadius:'18px 0 0 18px' }} />

            <div style={{ fontSize: 34, flexShrink: 0, filter:'drop-shadow(0 0 8px rgba(251,191,36,0.4))' }}>🎂</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#f3f4f6', fontWeight: 700, fontSize: 13, margin: '0 0 3px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                🎉 {person.full_name.split(' ')[0]}'s Birthday Today!
              </p>
              <p style={{ color: '#94a3b8', fontSize: 11, margin: 0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {person.full_name}{person.department ? ` · ${person.department}` : ''}
              </p>
            </div>

            <button
              onClick={() => onDismiss(person.id)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#64748b', cursor: 'pointer',
                fontSize: 14, lineHeight: 1, padding: '4px 7px', flexShrink: 0,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color='#e2e8f0'}
              onMouseLeave={e => e.currentTarget.style.color='#64748b'}
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BirthdayManager — mounts once per session, orchestrates everything
// ─────────────────────────────────────────────────────────────────────────────
export function BirthdayManager({ user }) {
  const [confetti,       setConfetti      ] = useState(false)
  const [selfModal,      setSelfModal     ] = useState(false)
  const [otherBirthdays, setOtherBirthdays] = useState([])
  const [dismissed,      setDismissed     ] = useState(new Set())

  useEffect(() => {
    if (!user?.id) return

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })

    getTodaysBirthdays()
      .then(async people => {
        const isMyBday = people.some(p => p.id === user.id)
        const others   = people.filter(p => p.id !== user.id)

        setOtherBirthdays(others)

        if (isMyBday) {
          setConfetti(true)
          setSelfModal(true)

          // Send email once per day
          const emailKey = `wt-bday-email-${today}`
          if (!localStorage.getItem(emailKey)) {
            localStorage.setItem(emailKey, '1')
            const me = people.find(p => p.id === user.id)
            getSettings().then(s => sendBirthdayEmail(me, s)).catch(() => {})
          }
        }
      })
      .catch(() => {})
  }, [user?.id])

  const visibleBanners = otherBirthdays.filter(p => !dismissed.has(p.id))
  const dismiss = useCallback(id => setDismissed(s => new Set([...s, id])), [])

  return (
    <>
      <Confetti run={confetti} />
      <AnimatePresence>
        {selfModal && (
          <BirthdaySelfModal user={user} onClose={() => setSelfModal(false)} />
        )}
      </AnimatePresence>
      {visibleBanners.length > 0 && (
        <BirthdayBanners birthdays={visibleBanners} onDismiss={dismiss} />
      )}
    </>
  )
}
