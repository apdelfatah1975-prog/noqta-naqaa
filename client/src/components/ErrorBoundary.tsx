import { AlertTriangle, RotateCcw } from "lucide-react";
import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[PurePoint] page render error", error);
  }

  componentDidUpdate(previousProps: Props) {
    if (previousProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  private retry = () => {
    this.setState({ hasError: false });
    window.setTimeout(() => window.location.reload(), 0);
  };

  render() {
    if (this.state.hasError) {
      return (
        <section className="flex min-h-[50vh] items-center justify-center bg-background px-5 py-12" dir="rtl" role="alert">
          <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
            <AlertTriangle size={44} className="mx-auto mb-5 text-amber-600" aria-hidden="true" />
            <h2 className="text-xl font-black text-amber-950">تعذر فتح هذه الصفحة</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-amber-900/80">
              حدث خطأ مؤقت أثناء تحميل البيانات. لم تُحذف أي بيانات، ويمكنك إعادة المحاولة الآن.
            </p>
            <button
              type="button"
              onClick={this.retry}
              className="mx-auto mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-700 px-5 font-bold text-white transition hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              <RotateCcw size={17} aria-hidden="true" />
              إعادة فتح الصفحة
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

