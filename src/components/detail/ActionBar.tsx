interface ActionBarProps {
  hasPrompt: boolean;
  hasVariants: boolean;
  isApproved: boolean;
  isGeneratingPrompt: boolean;
  isGeneratingImage: boolean;
  onGeneratePrompt: () => void;
  onGenerateImage: () => void;
  onApprove: () => void;
}

export function ActionBar({
  hasPrompt,
  hasVariants,
  isApproved,
  isGeneratingPrompt,
  isGeneratingImage,
  onGeneratePrompt,
  onGenerateImage,
  onApprove,
}: ActionBarProps) {
  return (
    <div className="action-bar">
      <button
        className="soft-button soft-button--primary"
        onClick={onGeneratePrompt}
        disabled={isGeneratingPrompt || isGeneratingImage}
      >
        {isGeneratingPrompt && <span className="spinner spinner--small" />}
        {hasPrompt ? "Regenerate Prompt" : "Generate Prompt"}
      </button>
      <button
        className="soft-button"
        onClick={onGenerateImage}
        disabled={!hasPrompt || isGeneratingPrompt || isGeneratingImage}
      >
        {isGeneratingImage && <span className="spinner spinner--small" />}
        {hasVariants ? "Generate Another" : "Generate Image"}
      </button>
      {hasVariants && (
        <button
          className={`soft-button soft-button--success${isApproved ? "" : ""}`}
          onClick={onApprove}
          disabled={isApproved || isGeneratingImage}
        >
          {isApproved ? "Approved" : "Approve"}
        </button>
      )}
    </div>
  );
}
