import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertTriangle className="text-red-400" size={40} />
          <p className="text-gray-400">Something went wrong. Please refresh.</p>
        </div>
      )
    }
    return this.props.children
  }
}
