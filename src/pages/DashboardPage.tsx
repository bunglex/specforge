interface DashboardProps {
  session: any;
  context: any;
  contextError: string;
  contextLoading: boolean;
  selectedWorkspaceId: string;
  setSelectedWorkspaceId: (value: string) => void;
  selectedProject: string;
  setSelectedProject: (value: string) => void;
  projects: string[];
  filteredDocuments: any[];
  onCreateDocument: (projectName: string, title: string) => Promise<void>;
  onOpenDocument: (id: string) => void;
  onSignOut: () => Promise<void>;
}

export default function DashboardPage(props: DashboardProps) {
  const { session, context, contextError, contextLoading, selectedWorkspaceId, setSelectedWorkspaceId, selectedProject, setSelectedProject, projects, filteredDocuments } = props;

  return (
    <main className="shell">
      <header className="topbar"><div><h1>Spec Writer</h1><p>Dashboard · {session?.user?.email || ''}</p></div><button className="ghost" onClick={() => void props.onSignOut()}>Sign out</button></header>

      <section className="panel">
        <h2>Workspace & project</h2>
        {contextError && <p className="error">{contextError}</p>}
        <div className="builder-controls">
          <label>Workspace</label>
          <select value={selectedWorkspaceId} onChange={(e) => setSelectedWorkspaceId(e.target.value)}>
            {context.workspaces.length === 0 ? <option value="">No workspaces available</option> : null}
            {context.workspaces.map((workspace: any) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
          <label>Project</label>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((project) => <option key={project} value={project}>{project}</option>)}
          </select>
        </div>
      </section>

      <section className="panel">
        <h2>Create document</h2>
        <form className="builder-controls" onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const projectName = String(form.get('projectName') || '');
          const title = String(form.get('title') || '');
          void props.onCreateDocument(projectName, title);
        }}>
          <label>Project</label><input name="projectName" required />
          <label>Document title</label><input name="title" required />
          <span />
          <button type="submit" disabled={!selectedWorkspaceId}>Create and open editor</button>
        </form>
      </section>

      <section className="panel">
        <h2>Documents</h2>
        {contextLoading && <p>Loading data…</p>}
        {filteredDocuments.length === 0 ? <p className="muted">No documents found for this selection.</p> : null}
        <div className="doc-list">
          {filteredDocuments.map((doc: any) => (
            <article key={doc.id}>
              <div><strong>{doc.title}</strong><p className="muted">{doc.project_name || 'No project'}</p></div>
              <button onClick={() => props.onOpenDocument(String(doc.id))}>Open editor</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
