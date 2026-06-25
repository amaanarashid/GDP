// ============================================================
// RUL MODEL — TensorFlow.js in-browser
// Small dense net that maps component features → days remaining.
// Trained on synthetic data derived from degradation patterns.
// ============================================================

import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-cpu'
import { sequential, layers } from '@tensorflow/tfjs-layers'
import { FEATURE_COUNT } from './features'

const MAX_RUL = 180 // cap predictions at 180 days

let model = null
let training = null // promise guard
let backendReady = false

async function ensureBackend() {
  if (backendReady) return
  await tf.setBackend('cpu')
  await tf.ready()
  backendReady = true
}

// ── Generate synthetic training data ───────────────────────
// We model the relationship: healthier features → more days.
// Features are [mean, std, slope, last, timeAboveWarn, pctOfCritical, worstCrit, complexity]
function makeTrainingData(samples = 1500) {
  const xs = []
  const ys = []

  for (let i = 0; i < samples; i++) {
    // Random "degradation level" 0 (healthy) → 1 (failing)
    const deg = Math.random()

    const meanF        = 0.3 + deg * 0.6 + rand(0.05)
    const stdF         = deg * 0.5 + rand(0.05)
    const slopeF       = deg * 0.8 + rand(0.1)       // climbing when degrading
    const lastF        = 0.3 + deg * 0.65 + rand(0.05)
    const aboveWarnF   = Math.max(0, deg - 0.3) * 1.4 + rand(0.05)
    const critF        = 0.3 + deg * 0.65 + rand(0.05)
    const worstCritF   = Math.min(1, critF + rand(0.1))
    const complexityF  = 0.25 + Math.random() * 0.75

    // Target RUL: inverse of degradation, with noise
    // healthy (deg~0) → ~180 days, failing (deg~1) → ~2 days
    let rul = MAX_RUL * Math.pow(1 - deg, 2.2)
    rul = Math.max(1, rul + (Math.random() - 0.5) * 12)

    xs.push([
      clamp01(meanF), clamp01(stdF), clamp01(slopeF), clamp01(lastF),
      clamp01(aboveWarnF), clamp01(critF), clamp01(worstCritF), clamp01(complexityF),
    ])
    ys.push([rul / MAX_RUL]) // normalize target to 0..1
  }

  return { xs: tf.tensor2d(xs), ys: tf.tensor2d(ys) }
}

function rand(a)    { return (Math.random() - 0.5) * 2 * a }
function clamp01(v) { return Math.max(0, Math.min(1, v)) }

// ── Build model architecture ───────────────────────────────
function buildModel() {
  const m = sequential()
  m.add(layers.dense({ inputShape: [FEATURE_COUNT], units: 32, activation: 'relu' }))
  m.add(layers.dense({ units: 16, activation: 'relu' }))
  m.add(layers.dense({ units: 1, activation: 'linear' }))
  m.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' })
  return m
}

// ── Train (or return cached) ───────────────────────────────
export async function ensureModel(onProgress) {
  if (model) return model
  if (training) return training

  training = (async () => {
    await ensureBackend()
    const m = buildModel()
    const { xs, ys } = makeTrainingData(1500)
    await m.fit(xs, ys, {
      epochs: 40,
      batchSize: 64,
      shuffle: true,
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          onProgress?.(Math.round(((epoch + 1) / 40) * 100), logs?.loss)
        },
      },
    })
    xs.dispose()
    ys.dispose()
    model = m
    return m
  })()

  return training
}

// ── Predict RUL for a feature vector ───────────────────────
export async function predictRUL(featureVector) {
  const m = await ensureModel()
  const input = tf.tensor2d([featureVector])
  const out = m.predict(input)
  const norm = (await out.data())[0]
  input.dispose()
  out.dispose()

  const days = Math.max(0, Math.round(norm * MAX_RUL))
  // Confidence: higher when features are decisive (near 0 or near 1 health)
  const decisiveness = Math.abs(featureVector[5] - 0.5) * 2 // pctOfCritical distance from middle
  const confidence = Math.round(60 + decisiveness * 35)
  return { days: Math.min(days, MAX_RUL), confidence: Math.min(99, confidence) }
}

// ── Predict for many components at once ────────────────────
export async function predictComponents(componentFeatureMap) {
  // componentFeatureMap: { componentId: featureVector }
  const results = {}
  for (const [compId, features] of Object.entries(componentFeatureMap)) {
    results[compId] = await predictRUL(features)
  }
  return results
}

export function isModelReady() { return model !== null }
