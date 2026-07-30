export default function Spinner({ label = 'Loading…', full = false }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${full ? 'min-h-screen' : 'py-12'}`}>
      <div className="w-8 h-8 border-2 border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  )
}
