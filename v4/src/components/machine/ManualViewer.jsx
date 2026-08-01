// ============================================================
// MANUAL VIEWER — full-screen PDF reader with real text search.
//
// The PDF itself is displayed by the browser's native viewer in an
// <iframe> (free page nav, zoom, print, Ctrl+F).
//
// Search is done properly with pdf.js: we extract the text of every
// page once, then search that index locally. Results list the page
// number and a snippet; clicking one jumps the viewer to that page
// via #page=N — which every browser PDF viewer honours, unlike
// #search= which only Chrome/Edge partially support.
// ============================================================
import { useState, useEffect, useRef, useMemo } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { X, Search, ExternalLink, FileText, Loader2 } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const SNIPPET_PAD = 60      // characters of context around a hit

export default function ManualViewer({ machine, onClose }) {
  const [pages, setPages]     = useState(null)   // [{ page, text }]
  const [status, setStatus]   = useState('loading')  // loading | ready | error
  const [errMsg, setErrMsg]   = useState('')
  const [term, setTerm]       = useState('')
  const [page, setPage]       = useState(null)   // page to display
  const inputRef = useRef(null)

  const base = machine.manual_url

  // ── Extract text once, in the background ──
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const doc = await pdfjsLib.getDocument(base).promise
        const out = []
        for (let p = 1; p <= doc.numPages; p++) {
          const pg = await doc.getPage(p)
          const tc = await pg.getTextContent()
          out.push({ page: p, text: tc.items.map(i => i.str).join(' ') })
          if (!alive) return
        }
        if (!alive) return
        setPages(out)
        setStatus('ready')
      } catch (e) {
        if (!alive) return
        setErrMsg(e?.message || 'Could not read this PDF')
        setStatus('error')
      }
    })()
    return () => { alive = false }
  }, [base])

  // ── Search the extracted text ──
  const results = useMemo(() => {
    const q = term.trim().toLowerCase()
    if (!q || !pages) return []
    const hits = []
    for (const { page: p, text } of pages) {
      const hay = text.toLowerCase()
      let idx = hay.indexOf(q)
      let countOnPage = 0
      while (idx !== -1 && countOnPage < 3) {          // up to 3 snippets/page
        const from = Math.max(0, idx - SNIPPET_PAD)
        const to   = Math.min(text.length, idx + q.length + SNIPPET_PAD)
        hits.push({
          page: p,
          before: (from > 0 ? '…' : '') + text.slice(from, idx),
          match:  text.slice(idx, idx + q.length),
          after:  text.slice(idx + q.length, to) + (to < text.length ? '…' : ''),
        })
        countOnPage++
        idx = hay.indexOf(q, idx + q.length)
      }
      if (hits.length > 60) break                       // keep the list sane
    }
    return hits
  }, [term, pages])

  const pageCount = pages?.length ?? 0
  const src = page ? `${base}#page=${page}` : base

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col p-3 md:p-6">
      <div className="card w-full max-w-6xl mx-auto flex-1 flex flex-col min-h-0 p-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 flex-wrap">
          <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">Machine manual</p>
            <p className="text-xs text-gray-500 truncate">
              {machine.manual_name || 'manual.pdf'} · {machine.name}
              {status === 'ready' && ` · ${pageCount} pages`}
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input ref={inputRef} value={term} onChange={e => setTerm(e.target.value)}
              disabled={status !== 'ready'}
              className="input pl-8 w-48 md:w-72"
              placeholder={status === 'ready' ? 'Search the manual…' : 'Reading PDF…'} />
          </div>

          <a href={base} target="_blank" rel="noreferrer" className="icon-btn" title="Open in new tab">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Results sidebar — only when searching */}
          {term.trim() && (
            <div className="md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 overflow-y-auto max-h-48 md:max-h-none">
              <div className="px-3 py-2 border-b border-gray-200 sticky top-0 bg-gray-50">
                <p className="text-xs text-gray-600">
                  {status === 'loading' && 'Reading PDF…'}
                  {status === 'ready' && (
                    results.length
                      ? <>{results.length} match{results.length > 1 ? 'es' : ''} — click to jump</>
                      : <>No matches for “{term.trim()}”</>
                  )}
                </p>
              </div>
              <div className="divide-y divide-gray-200">
                {results.map((r, i) => (
                  <button key={i} onClick={() => setPage(r.page)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-white transition-colors ${
                      page === r.page ? 'bg-white' : ''}`}>
                    <p className="text-[10px] font-semibold text-indigo-600 mb-0.5">PAGE {r.page}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {r.before}
                      <mark className="bg-yellow-200 text-gray-900 rounded px-0.5">{r.match}</mark>
                      {r.after}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PDF */}
          <div className="flex-1 min-h-0 bg-gray-100 relative">
            {status === 'loading' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span className="text-xs text-gray-600">Indexing text for search…</span>
              </div>
            )}
            {status === 'error' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white border border-red-300 rounded-lg px-3 py-1.5 shadow-sm">
                <span className="text-xs text-red-600">Search unavailable ({errMsg}) — use Ctrl+F instead.</span>
              </div>
            )}
            <iframe
              key={page || 'first'}
              src={src}
              title={`Manual for ${machine.name}`}
              className="w-full h-full border-0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
