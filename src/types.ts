export type BlockType = 'text' | 'clause_ref';

export interface DocumentBlock {
  id: string;
  type: BlockType;
  body?: string;
  include?: boolean;
  locked?: boolean;
  tags?: string[];
  clause_id?: string;
  level?: 'basic' | 'standard' | 'robust';
  overrides?: { body?: string };
}

export interface DocumentSection {
  id: string;
  title: string;
  blocks: DocumentBlock[];
}

export interface SpecDocument {
  id: string;
  workspace_id: string;
  title: string;
  project_name?: string;
  structure: { sections: DocumentSection[] };
  variable_values: Record<string, string>;
  updated_at?: string;
  _workspaceClauses?: Clause[];
}

export interface Clause {
  id: string;
  title: string;
  body?: string;
  metadata?: Record<string, any>;
}
