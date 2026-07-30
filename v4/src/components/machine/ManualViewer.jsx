// ============================================================
// MANUAL VIEWER — full-screen PDF reader for technicians.
//
// Uses the browser's native PDF viewer inside an <iframe>, which
// already provides text search, page navigation, zoom and print —
// no PDF parsing library, nothing extra to load or break.
//
// The search box uses PDF Open Parameters (#search=/#page=). Chrome
// and Edge honour these; Firefox/Safari ignore #search, so we always
// show the Ctrl+F fallback hint and an "open in new tab" escape.
// ============================================================
import { useState, useRef } from 'react'
import { X, Search, ExternalLink, FileText, RotateCcw } from 'lucide-react'

export default function ManualViewer({ machine, onClose }) {
  const [term, setTerm]   = useState('')
  const [frameKey, setKey] = useState(0)   // remount iframe to apply the hash
  const [applied, setApplied] = useState('')
  const inputRef = useRef(null)

  const base = machine.manual_url
  // #search jumps to the first match; toolbar=1 keeps the native controls
  const src = applied
    ? `${base}#search=${encodeURIComponent(applied)}`
    : base

  function submit(e) {
    e.preventDefault()
    setApplied(term.trim())
    setKey(k => k + 1)
  }

  function clear() {
    setTerm(''); setApplied(''); setKey(k => k + 1)
    inputRef.current?.focus()
  }

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
            </p>
          </div>

          {/* Search */}
          <form onSubmit={submit} className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input ref={inputRef} value={term} onChange={e => setTerm(e.target.value)}
                className="input pl-8 w-44 md:w-60" placeholder="Find in manual…" />
            </div>
            <button type="submit" className="btn-primary text-sm">Find</button>
            {applied && (
              <button type="button" onClick={clear} className="icon-btn" title="Clear search">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </form>

          <a href={base} target="_blank" rel="noreferrer" className="icon-btn" title="Open in new tab">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hint bar */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <p className="text-[11px] text-gray-500">
            {applied
              ? <>Jumped to the first match for <span className="text-gray-800 font-medium">“{applied}”</span>. Not supported in every browser — press <kbd className="px-1 py-0.5 border border-gray-300 rounded bg-white">Ctrl</kbd>+<kbd className="px-1 py-0.5 border border-gray-300 rounded bg-white">F</kbd> inside the document to search and step through all matches.</>
              : <>Type a chapter or part name above, or click inside the document and press <kbd className="px-1 py-0.5 border border-gray-300 rounded bg-white">Ctrl</kbd>+<kbd className="px-1 py-0.5 border border-gray-300 rounded bg-white">F</kbd> to search.</>}
          </p>
        </div>

        {/* PDF */}
        <div className="flex-1 min-h-0 bg-gray-100">
          <iframe
            key={frameKey}
            src={src}
            title={`Manual for ${machine.name}`}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  )
}
