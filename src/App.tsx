import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { Toasts } from "./components/layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";

const SetupDetails = lazy(() => import("./pages/SetupDetails"));
const SetupUpload = lazy(() => import("./pages/SetupUpload"));
const SetupReview = lazy(() => import("./pages/profile/ProfilePage").then((m) => ({ default: m.SetupReview })));
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const Home = lazy(() => import("./pages/Home"));
const NewJob = lazy(() => import("./pages/NewJob"));
const Match = lazy(() => import("./pages/Match"));
const ResumePage = lazy(() => import("./pages/resume/ResumePage"));
const Grow = lazy(() => import("./pages/Grow"));

/** Scroll to the top on navigation, or to #anchor when the link has one. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 60);
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[nevora] render error", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-semibold tight">Something went wrong.</h1>
        <p className="text-muted">Your work is saved. Reload the page to continue.</p>
        <button type="button" onClick={() => location.reload()} className="h-11 rounded-full bg-brand px-6 text-[15px] font-medium text-white hover:bg-brand-hover">
          Reload
        </button>
      </main>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollManager />
        <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/setup/details" element={<SetupDetails />} />
            <Route path="/setup/upload" element={<SetupUpload />} />
            <Route path="/setup/review" element={<SetupReview />} />
            <Route path="/home" element={<Home />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/new/jd" element={<NewJob />} />
            <Route path="/new/match" element={<Match />} />
            <Route path="/new/resume" element={<ResumePage />} />
            <Route path="/new/grow" element={<Grow />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toasts />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
