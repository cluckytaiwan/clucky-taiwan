// src/components/ErrorBoundary.jsx
import { Component } from "react";

/**
 * React Error Boundary — menangkap runtime error di seluruh component tree
 * dan menampilkan UI fallback yang ramah pengguna alih-alih blank screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log ke console untuk debugging — di production bisa dikirim ke Sentry, dsb.
    console.error("ErrorBoundary caught an error:", error, info);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="font-display text-xl font-bold text-neutral-900 mb-2">
              Ups, Terjadi Kesalahan
            </h1>
            <p className="font-body text-sm text-neutral-500 mb-6 leading-relaxed">
              Terjadi kesalahan tak terduga pada aplikasi. Coba kembali ke beranda atau muat ulang halaman.
            </p>
            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-neutral-400 cursor-pointer mb-1">Detail error (untuk developer)</summary>
                <pre className="text-[11px] bg-neutral-100 rounded-lg p-3 text-neutral-600 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={() => this.handleReset()}
              className="w-full rounded-xl bg-primary py-3 font-body font-semibold text-white hover:bg-primary-dark transition-colors"
            >
              Kembali ke Beranda
            </button>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 w-full rounded-xl border border-neutral-200 py-3 font-body font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
