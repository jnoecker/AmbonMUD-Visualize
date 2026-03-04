interface PromptEditorProps {
  prompt: string;
  onChange: (prompt: string) => void;
  disabled?: boolean;
}

export function PromptEditor({ prompt, onChange, disabled }: PromptEditorProps) {
  return (
    <div className="prompt-editor">
      <label className="prompt-editor-label">Image Prompt</label>
      <textarea
        className="prompt-editor-textarea"
        value={prompt}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Generate or write an image prompt..."
      />
    </div>
  );
}
