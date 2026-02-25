import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { createDocument, loadWorkspaceContext } from './api';
import { hasSupabaseConfig, supabase } from './supabaseClient';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';

interface WorkspaceContext {
  workspaceMembers: any[];
  workspaces: any[];
  documents: any[];
  clauses: any[];
  tags: any[];
  taxonomy: any[];
  modules: any[];
}

const emptyContext: WorkspaceContext = {
  workspaceMembers: [],
  workspaces: [],
  documents: [],
  clauses: [],
  tags: [],
  taxonomy: [],
  modules: []
};

export default function App() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<WorkspaceContext>(emptyContext);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');

  const refreshContext = async () => {
    if (!session || !supabase) return;
    setContextLoading(true);
    setContextError('');
    try {
      const data = await loadWorkspaceContext();
      setContext(data as WorkspaceContext);
      setSelectedWorkspaceId((prev) => prev || String(data.workspaces?.[0]?.id || ''));
    } catch (error: any) {
      setContextError(error.message);
    } finally {
      setContextLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void refreshContext();
  }, [session]);

  const projects = useMemo(() => {
    return [...new Set(context.documents.filter((d) => String(d.workspace_id) === String(selectedWorkspaceId)).map((d) => d.project_name).filter(Boolean))].sort();
  }, [context.documents, selectedWorkspaceId]);

  const filteredDocuments = useMemo(() => {
    const docs = context.documents.filter((d) => String(d.workspace_id) === String(selectedWorkspaceId));
    return selectedProject === 'all' ? docs : docs.filter((d) => d.project_name === selectedProject);
  }, [context.documents, selectedWorkspaceId, selectedProject]);

  if (!hasSupabaseConfig()) {
    return <main className="shell"><section className="panel error-panel"><h1>Spec Writer</h1><p>Missing Supabase configuration in environment variables.</p></section></main>;
  }

  if (!session) {
    return (
      <main className="shell">
        <header><h1>Spec Writer</h1><p>Sign in to manage reusable clauses and structured documents.</p></header>
        <form className="panel auth-panel" onSubmit={async (event) => {
          event.preventDefault();
          if (!supabase) return;
          setLoading(true);
          setAuthError('');
          const form = new FormData(event.currentTarget);
          const email = String(form.get('email') || '');
          const password = String(form.get('password') || '');
          const result = authMode === 'signin'
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });
          if (result.error) setAuthError(result.error.message);
          setLoading(false);
        }}>
          <h2>{authMode === 'signin' ? 'Sign in' : 'Create account'}</h2>
          <label>Email</label><input name="email" type="email" required />
          <label>Password</label><input name="password" type="password" minLength={6} required />
          {authError && <p className="error">{authError}</p>}
          <div className="row">
            <button type="submit" disabled={loading}>{loading ? 'Working…' : authMode === 'signin' ? 'Sign in' : 'Create account'}</button>
            <button type="button" className="ghost" onClick={() => setAuthMode((m) => m === 'signin' ? 'signup' : 'signin')}>
              {authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={
        <DashboardPage
          session={session}
          context={context}
          contextError={contextError}
          contextLoading={contextLoading}
          selectedWorkspaceId={selectedWorkspaceId}
          setSelectedWorkspaceId={setSelectedWorkspaceId}
          selectedProject={selectedProject}
          setSelectedProject={setSelectedProject}
          projects={projects}
          filteredDocuments={filteredDocuments}
          onCreateDocument={async (projectName, title) => {
            const doc = await createDocument({ workspaceId: selectedWorkspaceId, projectName, title });
            await refreshContext();
            navigate(`/editor/${doc.id}`);
          }}
          onOpenDocument={(id) => navigate(`/editor/${id}`)}
          onSignOut={async () => {
            await supabase?.auth.signOut();
            navigate('/');
          }}
        />
      } />
      <Route path="/editor/:documentId" element={<EditorPage session={session} clauses={context.clauses} onBack={() => navigate('/')} onContextRefresh={refreshContext} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
