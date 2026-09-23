import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Account } from "./auth/Account";
import { SessionProvider } from "./auth/SessionProvider";
import { useSession } from "./auth/SessionContext";
import "./chat/chat.css";

const Messenger = lazy(() => import("./chat/Messenger"));
function Protected({ children }) {
  const { user, ready } = useSession();
  if (!ready) return <div className="page-status" role="status">Opening your account...</div>;
  return user ? children : <Navigate to="/signin" replace />;
}
// Supabase falls back to the site root after sign-in; keep its ?code= for the session exchange.
function ToChat() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/chat", search, hash }} replace />;
}

function App() {
  return (
    <SessionProvider>
      <Suspense fallback={<div className="page-status" role="status">Opening your chats...</div>}>
      <Routes>
        <Route path="/" element={<ToChat />} />
        <Route path="/signin" element={<Account />} />
        <Route path="/signup" element={<Account key="signup" mode="signup" />} />
        <Route path="/reset-password" element={<Account key="reset" mode="reset" />} />
        <Route path="/update-password" element={<Protected><Account key="update" mode="update" /></Protected>} />
        <Route path="/chat" element={<Protected><Messenger /></Protected>} />
        <Route path="*" element={<ToChat />} />
      </Routes>
      </Suspense>
    </SessionProvider>
  )
}

export default App
