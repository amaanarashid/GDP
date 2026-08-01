// ============================================================
// TWIN 3D — a rotatable 3D digital twin built from Three.js
// primitives (no external model files, so nothing can fail to
// load in a demo). Each machine type is assembled from boxes and
// cylinders; parts are named after DB components and painted by
// live health status:
//   green ≥75 · yellow ≥50 · red <50 (red parts pulse)
// Moving parts (fan, rollers, press ram) animate while the
// machine is running. Drag to rotate, scroll to zoom.
// Falls back gracefully if WebGL is unavailable.
// ============================================================
import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const STATUS = {
  green:  new THREE.Color(0x22c55e),
  yellow: new THREE.Color(0xeab308),
  red:    new THREE.Color(0xef4444),
  gray:   new THREE.Color(0x94a3b8),
}
const METAL = 0x64748b   // neutral structure color

function healthColor(h) {
  if (h == null || isNaN(h)) return STATUS.gray
  if (h >= 75) return STATUS.green
  if (h >= 50) return STATUS.yellow
  return STATUS.red
}

// Small helpers — every part registers its component name so we
// can paint it from live health later.
function mat(color = METAL) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35 })
}
function box(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
}
function cyl(rTop, rBot, h, color, seg = 24) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat(color))
}

// ── Machine builders ─────────────────────────────────────────
// Each returns { group, parts: {componentName: [mesh,...]}, spins: [{mesh, axis, speed}] }

function buildConveyor() {
  const g = new THREE.Group()
  const parts = {}, spins = []
  const reg = (name, m) => { (parts[name] = parts[name] || []).push(m); return m }

  // frame rails
  for (const z of [-0.55, 0.55]) {
    const rail = box(6, 0.18, 0.18); rail.position.set(0, 0.9, z); g.add(rail)
  }
  // legs
  for (const x of [-2.7, 0, 2.7]) for (const z of [-0.55, 0.55]) {
    const leg = box(0.14, 0.9, 0.14); leg.position.set(x, 0.45, z); g.add(leg)
  }
  // rollers (Bearings) — spin
  for (let x = -2.6; x <= 2.6; x += 0.65) {
    const r = reg('Bearings', cyl(0.13, 0.13, 1.05))
    r.rotation.x = Math.PI / 2; r.position.set(x, 1.06, 0); g.add(r)
    spins.push({ mesh: r, axis: 'y', speed: 4 })
  }
  // belt (Drive Belt)
  const belt = reg('Drive Belt', box(5.6, 0.06, 1.0, 0x334155))
  belt.position.set(0, 1.22, 0); g.add(belt)
  // motor (Electric Motor) + shaft
  const motor = reg('Electric Motor', cyl(0.38, 0.38, 1.0))
  motor.rotation.z = Math.PI / 2; motor.position.set(-3.4, 0.9, 0); g.add(motor)
  const shaft = cyl(0.07, 0.07, 0.5); shaft.rotation.z = Math.PI / 2
  shaft.position.set(-2.75, 0.9, 0); g.add(shaft)
  // gearbox
  const gear = reg('Gearbox', box(0.55, 0.55, 0.55))
  gear.position.set(-2.45, 0.9, 0); g.add(gear)
  // VFD panel
  const vfd = reg('VFD Drive', box(0.5, 0.8, 0.25))
  vfd.position.set(3.2, 1.0, -0.9); g.add(vfd)
  return { group: g, parts, spins }
}

function buildHydraulicPress() {
  const g = new THREE.Group()
  const parts = {}, spins = []
  const reg = (name, m) => { (parts[name] = parts[name] || []).push(m); return m }

  // bed + crown + columns
  const bed = box(3.0, 0.5, 2.0); bed.position.y = 0.25; g.add(bed)
  const crown = box(3.0, 0.6, 2.0); crown.position.y = 3.5; g.add(crown)
  for (const x of [-1.25, 1.25]) for (const z of [-0.75, 0.75]) {
    const col = cyl(0.14, 0.14, 3.0); col.position.set(x, 2.0, z); g.add(col)
  }
  // ram (Hydraulic Cylinder) — slides up/down while running
  const cylBody = reg('Hydraulic Cylinder', cyl(0.45, 0.45, 0.9))
  cylBody.position.set(0, 3.0, 0); g.add(cylBody)
  const ram = reg('Hydraulic Cylinder', cyl(0.22, 0.22, 1.2))
  ram.position.set(0, 2.1, 0); g.add(ram)
  const platen = reg('Hydraulic Cylinder', box(1.6, 0.22, 1.2))
  platen.position.set(0, 1.45, 0); g.add(platen)
  spins.push({ mesh: ram, axis: 'press', speed: 1, base: 2.1, follower: platen, followerBase: 1.45 })
  // motor + pump on the side
  const motor = reg('Electric Motor', cyl(0.32, 0.32, 0.8))
  motor.rotation.z = Math.PI / 2; motor.position.set(2.4, 0.85, -0.4); g.add(motor)
  const pump = reg('Hydraulic Pump', box(0.55, 0.5, 0.55))
  pump.position.set(2.4, 0.8, 0.45); g.add(pump)
  // oil tank + filter
  const tank = reg('Oil Tank', box(1.2, 0.8, 0.9))
  tank.position.set(-2.3, 0.65, 0); g.add(tank)
  const filt = reg('Oil Filter', cyl(0.16, 0.16, 0.45))
  filt.position.set(-2.3, 1.28, 0.25); g.add(filt)
  return { group: g, parts, spins }
}

function buildCompressor() {
  const g = new THREE.Group()
  const parts = {}, spins = []
  const reg = (name, m) => { (parts[name] = parts[name] || []).push(m); return m }

  // receiver tank (horizontal cylinder on legs)
  const tank = reg('Air Receiver Tank', cyl(0.8, 0.8, 3.6))
  tank.rotation.z = Math.PI / 2; tank.position.set(0, 1.0, 0); g.add(tank)
  for (const cap of [-1.8, 1.8]) {
    const end = reg('Air Receiver Tank', new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), mat()))
    end.position.set(cap, 1.0, 0); g.add(end)
  }
  for (const x of [-1.2, 1.2]) {
    const leg = box(0.16, 0.55, 0.6); leg.position.set(x, 0.28, 0); g.add(leg)
  }
  // compressor pump head on top
  const pump = reg('Compressor Pump', box(0.9, 0.7, 0.8))
  pump.position.set(-0.7, 2.15, 0); g.add(pump)
  const head = reg('Compressor Pump', box(1.05, 0.18, 0.95))
  head.position.set(-0.7, 2.6, 0); g.add(head)
  // motor beside pump
  const motor = reg('Electric Motor', cyl(0.34, 0.34, 0.9))
  motor.rotation.z = Math.PI / 2; motor.position.set(0.75, 2.1, 0); g.add(motor)
  // cooling fan on motor end — spins
  const fan = new THREE.Group()
  for (let i = 0; i < 5; i++) {
    const blade = reg('Cooling Fan', box(0.06, 0.5, 0.16))
    blade.position.y = 0.28
    const holder = new THREE.Group(); holder.add(blade)
    holder.rotation.x = (i / 5) * Math.PI * 2
    fan.add(holder)
  }
  const hub = reg('Cooling Fan', cyl(0.1, 0.1, 0.1)); hub.rotation.z = Math.PI / 2
  fan.add(hub)
  fan.rotation.z = Math.PI / 2
  fan.position.set(1.35, 2.1, 0); g.add(fan)
  spins.push({ mesh: fan, axis: 'x', speed: 8 })
  // air filter
  const filt = reg('Air Filter', cyl(0.18, 0.18, 0.4))
  filt.position.set(-1.25, 2.35, 0); g.add(filt)
  // pipe pump -> tank
  const pipe = cyl(0.06, 0.06, 0.85); pipe.position.set(-0.7, 1.6, 0); g.add(pipe)
  return { group: g, parts, spins }
}

// ── Generic builder: ANY machine, generated from its components ──
// Custom machines (admin-created, dataset machines) have no hand-drawn
// model, so we generate one: each component becomes a 3D part whose
// SHAPE is inferred from its name, laid out on a skid and labelled.
// This means a twin exists the moment a machine is created.

// name keyword → how to draw it
function shapeForComponent(name) {
  const n = (name || '').toLowerCase()
  if (/(fan|blower|impeller)/.test(n))            return 'fan'
  if (/(motor|drive|spindle)/.test(n))            return 'motor'
  if (/(tank|reservoir|vessel|receiver)/.test(n)) return 'tank'
  if (/(pump|compressor)/.test(n))                return 'pump'
  if (/(filter|cartridge|strainer)/.test(n))      return 'filter'
  if (/(belt|conveyor|chain)/.test(n))            return 'belt'
  if (/(bearing|roller|wheel|shaft)/.test(n))     return 'bearing'
  if (/(cylinder|piston|ram|actuator)/.test(n))   return 'cylinder'
  if (/(valve|manifold)/.test(n))                 return 'valve'
  if (/(panel|vfd|controller|sensor|board)/.test(n)) return 'panel'
  return 'generic'
}

// Text label that always faces the camera
function makeLabel(text) {
  const pad = 8, font = 34
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  ctx.font = `600 ${font}px system-ui, sans-serif`
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2
  c.width = w; c.height = font + pad * 2
  const c2 = c.getContext('2d')
  c2.font = `600 ${font}px system-ui, sans-serif`
  c2.fillStyle = 'rgba(255,255,255,0.92)'
  c2.fillRect(0, 0, c.width, c.height)
  c2.fillStyle = '#374151'
  c2.textBaseline = 'middle'
  c2.fillText(text, pad, c.height / 2)

  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  const scale = 0.0055
  sprite.scale.set(c.width * scale, c.height * scale, 1)
  return sprite
}

function buildGeneric(components = []) {
  const g = new THREE.Group()
  const parts = {}, spins = []
  const reg = (name, m) => { (parts[name] = parts[name] || []).push(m); return m }

  const list = components.length ? components : [{ name: 'Machine' }]
  const cols = Math.ceil(Math.sqrt(list.length))
  const rows = Math.ceil(list.length / cols)
  const SP = 2.0                                     // spacing between parts
  const w = cols * SP + 1.0, d = rows * SP + 1.0

  // skid / base frame
  const skid = box(w, 0.25, d); skid.position.y = 0.125; g.add(skid)
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.06, d),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 }))
  edge.position.y = 0.26; g.add(edge)

  list.forEach((c, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x = (col - (cols - 1) / 2) * SP
    const z = (row - (rows - 1) / 2) * SP
    const kind = shapeForComponent(c.name)
    let top = 1.0                                    // where to float the label

    if (kind === 'fan') {
      const fan = new THREE.Group()
      for (let b = 0; b < 5; b++) {
        const blade = reg(c.name, box(0.06, 0.5, 0.16))
        blade.position.y = 0.28
        const holder = new THREE.Group(); holder.add(blade)
        holder.rotation.x = (b / 5) * Math.PI * 2
        fan.add(holder)
      }
      fan.add(reg(c.name, cyl(0.12, 0.12, 0.12)))
      fan.position.set(x, 0.95, z); g.add(fan)
      spins.push({ mesh: fan, axis: 'y', speed: 8 })
      top = 1.6
    } else if (kind === 'motor') {
      const m = reg(c.name, cyl(0.36, 0.36, 0.95))
      m.rotation.z = Math.PI / 2; m.position.set(x, 0.75, z); g.add(m)
      const shaft = cyl(0.07, 0.07, 0.4); shaft.rotation.z = Math.PI / 2
      shaft.position.set(x + 0.65, 0.75, z); g.add(shaft)
      top = 1.35
    } else if (kind === 'tank') {
      const t = reg(c.name, cyl(0.45, 0.45, 1.2))
      t.position.set(x, 0.95, z); g.add(t)
      const capT = reg(c.name, new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 12), mat()))
      capT.position.set(x, 1.55, z); g.add(capT)
      top = 2.1
    } else if (kind === 'pump') {
      const p = reg(c.name, box(0.75, 0.6, 0.7)); p.position.set(x, 0.6, z); g.add(p)
      const inlet = cyl(0.09, 0.09, 0.5); inlet.rotation.z = Math.PI / 2
      inlet.position.set(x + 0.55, 0.6, z); g.add(inlet)
      top = 1.15
    } else if (kind === 'filter') {
      const f = reg(c.name, cyl(0.22, 0.22, 0.8)); f.position.set(x, 0.7, z); g.add(f)
      top = 1.25
    } else if (kind === 'belt') {
      const b = reg(c.name, box(1.5, 0.08, 0.6)); b.position.set(x, 0.75, z); g.add(b)
      for (const dx of [-0.7, 0.7]) {
        const r = reg(c.name, cyl(0.16, 0.16, 0.65))
        r.rotation.x = Math.PI / 2; r.position.set(x + dx, 0.68, z); g.add(r)
        spins.push({ mesh: r, axis: 'y', speed: 5 })
      }
      top = 1.2
    } else if (kind === 'bearing') {
      const b = reg(c.name, new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 12, 28), mat()))
      b.position.set(x, 0.75, z); g.add(b)
      spins.push({ mesh: b, axis: 'z', speed: 4 })
      top = 1.25
    } else if (kind === 'cylinder') {
      const body = reg(c.name, cyl(0.28, 0.28, 0.9)); body.position.set(x, 0.85, z); g.add(body)
      const rod = reg(c.name, cyl(0.12, 0.12, 0.6)); rod.position.set(x, 0.3, z); g.add(rod)
      top = 1.45
    } else if (kind === 'valve') {
      const v = reg(c.name, box(0.45, 0.45, 0.45)); v.position.set(x, 0.5, z); g.add(v)
      const stem = reg(c.name, cyl(0.07, 0.07, 0.35)); stem.position.set(x, 0.85, z); g.add(stem)
      top = 1.2
    } else if (kind === 'panel') {
      const p = reg(c.name, box(0.6, 0.9, 0.22)); p.position.set(x, 0.75, z); g.add(p)
      top = 1.3
    } else {
      const b = reg(c.name, box(0.8, 0.8, 0.8)); b.position.set(x, 0.65, z); g.add(b)
      top = 1.2
    }

    if (c.name) {
      const label = makeLabel(c.name)
      label.position.set(x, top + 0.25, z)
      g.add(label)
    }
  })

  return { group: g, parts, spins }
}

const BUILDERS = {
  conveyor_drive: buildConveyor,
  hydraulic_press: buildHydraulicPress,
  air_compressor: buildCompressor,
}

// Kept for callers that used it; every type renders in 3D now.
export const TWIN3D_TYPES = Object.keys(BUILDERS)

// ── Component ────────────────────────────────────────────────
// interactive=false renders a lightweight auto-rotating version for
// dashboard cards: no OrbitControls (so page scroll isn't hijacked),
// pointer events pass through (so the card click still navigates).
export default function Twin3D({ type, components = [], running = false, height = 300, interactive = true, showLegend = true, spin = true }) {
  const mountRef = useRef(null)
  const stateRef = useRef({ components, running })
  const [failed, setFailed] = useState(false)
  stateRef.current = { components, running }

  // Preset types have a hand-built model; anything else (custom /
  // dataset machines) is generated from its component list.
  const compKey = components.map(c => c.name).join('|')

  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const preset = BUILDERS[type]
    const builder = preset || (() => buildGeneric(stateRef.current.components))

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(6.5, 4.5, 6.5)

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.1))
    const dir = new THREE.DirectionalLight(0xffffff, 1.4)
    dir.position.set(5, 8, 4); scene.add(dir)

    const grid = new THREE.GridHelper(12, 24, 0xd1d5db, 0xe8eaee)
    scene.add(grid)

    const { group, parts, spins } = builder()
    scene.add(group)

    let controls = null
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 1.4, 0)
      controls.enableDamping = true
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.8
      controls.minDistance = 4
      controls.maxDistance = 16
      controls.maxPolarAngle = Math.PI / 2.05
      // On tablets, one finger must scroll the PAGE — otherwise the canvas
      // traps the gesture and the page feels stuck. Two fingers rotate/zoom.
      controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE }
    } else {
      camera.lookAt(0, 1.4, 0)
      renderer.domElement.style.pointerEvents = 'none'
      group.rotation.y = 0.5          // pleasant 3/4 view when static
    }

    const resize = () => {
      const w = el.clientWidth, h = height
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    let raf
    const clock = new THREE.Clock()
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const { components: comps, running: run } = stateRef.current

      // paint parts by live health (+ pulse red ones)
      const pulse = 0.5 + 0.5 * Math.sin(t * 5)
      for (const c of comps) {
        const meshes = parts[c.name]
        if (!meshes) continue
        const h = parseFloat(c.health_score ?? 100)
        const color = healthColor(h)
        for (const m of meshes) {
          m.material.color.copy(color)
          if (h < 50) {
            m.material.emissive.copy(STATUS.red)
            m.material.emissiveIntensity = 0.35 * pulse
          } else {
            m.material.emissiveIntensity = 0
          }
        }
      }
      // moving parts
      if (run) {
        const dt = clock.getDelta() || 0.016
        for (const s of spins) {
          if (s.axis === 'press') {
            const y = s.base - 0.35 * (0.5 + 0.5 * Math.sin(t * 1.5))
            s.mesh.position.y = y
            if (s.follower) s.follower.position.y = s.followerBase - (s.base - y)
          } else {
            s.mesh.rotation[s.axis] += s.speed * dt * 4
          }
        }
      }
      if (controls) controls.update()
      else if (spin) group.rotation.y += 0.004   // gentle auto-spin (off for technician dashboard cards)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      if (controls) controls.dispose()
      renderer.dispose()
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) {
          if (o.material.map) o.material.map.dispose()   // label textures
          o.material.dispose()
        }
      })
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
    // compKey: rebuild the generated model if the component list changes
  }, [type, height, interactive, spin, compKey])

  if (failed) return null

  return (
    <div>
      <div ref={mountRef} style={{ height }}
        className={`w-full ${interactive ? 'cursor-grab active:cursor-grabbing' : ''}`} />
      {showLegend && (
      <div className="flex items-center gap-4 flex-wrap mt-2 text-[10px] text-gray-500">
        {components.map(c => {
          const h = parseFloat(c.health_score ?? 100)
          const dot = h >= 75 ? 'bg-green-500' : h >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          return (
            <span key={c.id} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${dot}`} /> {c.name}
            </span>
          )
        })}
        <span className="ml-auto text-gray-400">
          drag to rotate · scroll to zoom
          <span className="hidden [@media(pointer:coarse)]:inline"> · two fingers on touch</span>
        </span>
      </div>
      )}
    </div>
  )
}
