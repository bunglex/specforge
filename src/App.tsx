import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';
import AuthPage from './pages/AuthPage';
import { hasSupabaseConfig } from './supabaseClient';
import { useSession } from './hooks/useSession';
import { useWorkspaceContext } from './hooks/useWorkspaceContext';
import AppShell from './components/AppShell';

function RequireAuth({ session, children }: { session: any; children: JSX.Element }) {
  if (!session) {
    return <AuthPage />;
  }
  return children;
}

export default function App() {
  const { session, loading } = useSession();
  const { context, loading: contextLoading, error: contextError, refresh } = useWorkspaceContext(session);

  if (!hasSupabaseConfig()) {
    return <AppShell><section className="panel error-panel"><h1>Spec Writer</h1><p>Missing Supabase configuration in environment variables.</p></section></AppShell>;
  }

  if (loading) {
    return <AppShell><section className="panel"><p>Loading session…</p></section></AppShell>;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={(
          <RequireAuth session={session}>
            <DashboardPage
              session={session}
              context={context}
              contextError={contextError}
              contextLoading={contextLoading}
              onContextRefresh={refresh}
            />
          </RequireAuth>
        )}
      />
      <Route
        path="/editor/:documentId"
        element={(
          <RequireAuth session={session}>
            <EditorPage clauses={context.clauses || []} />
          </RequireAuth>
        )}
      />
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
