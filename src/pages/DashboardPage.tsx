import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createDocument } from '../api';
import AppShell from '../components/AppShell';
import { supabase } from '../supabaseClient';

export default function DashboardPage({ session, context, contextError, contextLoading, onContextRefresh }: {
  session: any;
  context: any;
  contextError: string;
  contextLoading: boolean;
  onContextRefresh: () => Promise<void>;
}) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');
  const [createError, setCreateError] = useState('');

  const activeWorkspaceId = selectedWorkspaceId || String(context.workspaces?.[0]?.id || '');

  const projects = useMemo(() => {
    return [...new Set((context.documents || [])
      .filter((d: any) => String(d.workspace_id) === String(activeWorkspaceId))
      .map((d: any) => d.project_name)
      .filter(Boolean))].sort();
  }, [context.documents, activeWorkspaceId]);

  const filteredDocuments = useMemo(() => {
    const docs = (context.documents || []).filter((d: any) => String(d.workspace_id) === String(activeWorkspaceId));
    return selectedProject === 'all' ? docs : docs.filter((d: any) => d.project_name === selectedProject);
  }, [context.documents, activeWorkspaceId, selectedProject]);

  return (
    <AppShell
      header={(
        <header className="topbar">
          <div><h1>Spec Writer</h1><p>Dashboard · {session?.user?.email || ''}</p></div>
          <button className="ghost" onClick={() => void supabase?.auth.signOut()}>Sign out</button>
        </header>
      )}
    >
      <section className="panel">
        <h2>Workspace & project</h2>
        {contextError ? <p className="error">{contextError}</p> : null}
        <div className="builder-controls">
          <label>Workspace</label>
          <select value={activeWorkspaceId} onChange={(e) => setSelectedWorkspaceId(e.target.value)}>
            {context.workspaces.length === 0 ? <option value="">No workspaces available</option> : null}
            {context.workspaces.map((workspace: any) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
          <label>Project</label>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((project: string) => <option key={project} value={project}>{project}</option>)}
          </select>
        </div>
      </section>

      <section className="panel">
        <h2>Create document</h2>
        {createError ? <p className="error">{createError}</p> : null}
        <form className="builder-controls" onSubmit={async (e) => {
          e.preventDefault();
          setCreateError('');
          const form = new FormData(e.currentTarget);
          const projectName = String(form.get('projectName') || '');
          const title = String(form.get('title') || '');
          try {
            await createDocument({ workspaceId: activeWorkspaceId, projectName, title });
            await onContextRefresh();
            e.currentTarget.reset();
          } catch (error: any) {
            setCreateError(error.message || 'Failed to create document.');
          }
        }}>
          <label>Project</label><input name="projectName" required />
          <label>Document title</label><input name="title" required />
          <span />
          <button type="submit" disabled={!activeWorkspaceId}>Create document</button>
        </form>
      </section>

      <section className="panel">
        <h2>Documents</h2>
        {contextLoading ? <p>Loading data…</p> : null}
        {filteredDocuments.length === 0 ? <p className="muted">No documents found for this selection.</p> : null}
        <div className="doc-list">
          {filteredDocuments.map((doc: any) => (
            <article key={doc.id}>
              <div><strong>{doc.title}</strong><p className="muted">{doc.project_name || 'No project'}</p></div>
              <Link to={`/editor/${doc.id}`}><button>Open editor</button></Link>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
