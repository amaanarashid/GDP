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

const BUILDERS = {
  conveyor_drive: buildConveyor,
  hydraulic_press: buildHydraulicPress,
  air_compressor: buildCompressor,
}

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

  useEffect(() => {
    const el = mountRef.current
    const builder = BUILDERS[type]
    if (!el || !builder) return

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
        if (o.material) o.material.dispose()
      })
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
  }, [type, height, interactive, spin])

  if (failed || !BUILDERS[type]) return null

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
        <span className="ml-auto text-gray-400">drag to rotate · scroll to zoom</span>
      </div>
      )}
    </div>
  )
}
