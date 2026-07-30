export default function LoadingSpinner({ label = 'Loading...' }: { label?: string }) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <div className="w-10 h-10 border-4 border-gray-700 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">{label}</p>
      </div>
    )
  }