/**
 * DiaryEditor — ContentEditable rich text editing surface.
 *
 * Renders a contentEditable div with:
 * - Event delegation for widget placeholders (no inline onclick)
 * - dir="auto" for RTL support
 * - Scoped font/color via CSS vars from parent theme
 *
 * No dangerouslySetInnerHTML — content managed via ref + onInput.
 */

import type { DiaryEditorReturn } from '../hooks/useDiaryEditor';

interface DiaryEditorProps {
  editor: DiaryEditorReturn;
  fontFamily: string;
}

export function DiaryEditor({ editor, fontFamily }: DiaryEditorProps) {
  const { editorRef, state, handleInput, handleEditorClick } = editor;

  return (
    <div className="relative">
      {/* Editor surface */}
      <div
        ref={editorRef}
        className="outline-none px-6 py-4 diary-editor-content"
        contentEditable
        dir="auto"
        role="textbox"
        aria-multiline="true"
        aria-label="Diary editor"
        style={{
          fontFamily,
          color: 'var(--diary-text)',
          fontSize: '1.1rem',
          lineHeight: 1.8,
          caretColor: 'var(--diary-accent)',
          minHeight: 200,
        }}
        onInput={handleInput}
        onClick={handleEditorClick}
        suppressContentEditableWarning
      />

      {/* Word count */}
      <div
        className="px-6 py-2 text-xs select-none"
        style={{ color: 'var(--diary-muted)' }}
        aria-live="polite"
      >
        {state.wordCount > 0 ? `${state.wordCount} words` : ''}
      </div>
    </div>
  );
}
