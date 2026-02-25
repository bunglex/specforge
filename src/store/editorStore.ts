import { create } from 'zustand';
import type { Clause, SpecDocument } from '../types';

interface EditorState {
  document: SpecDocument | null;
  selectedSectionId: string;
  selectedBlockId: string;
  dirty: boolean;
  isSaving: boolean;
  lastSavedAt: string;
  saveError: string;
  saveStatus: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  setDocument: (document: SpecDocument, clauses: Clause[]) => void;
  setSelectedBlock: (sectionId: string, blockId: string) => void;
  updateBlockText: (sectionId: string, blockId: string, body: string) => void;
  updateVariableValue: (key: string, value: string) => void;
  markSaving: () => void;
  markSaved: () => void;
  markSaveError: (message: string) => void;
  clearDirty: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  document: null,
  selectedSectionId: '',
  selectedBlockId: '',
  dirty: false,
  isSaving: false,
  lastSavedAt: '',
  saveError: '',
  saveStatus: 'idle',
  setDocument: (document, clauses) => {
    const firstSection = document.structure?.sections?.[0];
    const firstBlock = firstSection?.blocks?.[0];
    set({
      document: { ...document, _workspaceClauses: clauses },
      selectedSectionId: firstSection?.id || '',
      selectedBlockId: firstBlock?.id || '',
      dirty: false,
      isSaving: false,
      saveStatus: 'saved',
      saveError: ''
    });
  },
  setSelectedBlock: (sectionId, blockId) => set({ selectedSectionId: sectionId, selectedBlockId: blockId }),
  updateBlockText: (sectionId, blockId, body) =>
    set((state) => {
      if (!state.document) return state;
      return {
        document: {
          ...state.document,
          structure: {
            ...state.document.structure,
            sections: state.document.structure.sections.map((section) =>
              section.id === sectionId
                ? {
                    ...section,
                    blocks: section.blocks.map((block) =>
                      block.id === blockId && block.type === 'text' ? { ...block, body } : block
                    )
                  }
                : section
            )
          }
        },
        dirty: true,
        saveStatus: 'dirty',
        saveError: ''
      };
    }),
  updateVariableValue: (key, value) =>
    set((state) => {
      if (!state.document) return state;
      return {
        document: {
          ...state.document,
          variable_values: {
            ...state.document.variable_values,
            [key]: value
          }
        },
        dirty: true,
        saveStatus: 'dirty',
        saveError: ''
      };
    }),
  markSaving: () => set({ isSaving: true, saveStatus: 'saving', saveError: '' }),
  markSaved: () =>
    set({
      isSaving: false,
      dirty: false,
      saveStatus: 'saved',
      lastSavedAt: new Date().toLocaleTimeString(),
      saveError: ''
    }),
  markSaveError: (message) => set({ isSaving: false, saveStatus: 'error', saveError: message }),
  clearDirty: () => set({ dirty: false })
}));
