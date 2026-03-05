import type { EntityType } from "../../types/entities";

interface ActionBarProps {
  hasPrompt: boolean;
  hasVariants: boolean;
  isApproved: boolean;
  isGeneratingPrompt: boolean;
  isGeneratingImage: boolean;
  isRemovingBg: boolean;
  entityType: EntityType;
  onGeneratePrompt: () => void;
  onGenerateImage: () => void;
  onApprove: () => void;
  onRemoveBackground: () => void;
}

export function ActionBar({
  hasPrompt,
  hasVariants,
  isApproved,
  isGeneratingPrompt,
  isGeneratingImage,
  isRemovingBg,
  entityType,
  onGeneratePrompt,
  onGenerateImage,
  onApprove,
  onRemoveBackground,
}: ActionBarProps) {
  const busy = isGeneratingPrompt || isGeneratingImage || isRemovingBg;

  return (
    <div className="action-bar">
      <button
        className="soft-button soft-button--primary"
        onClick={onGeneratePrompt}
        disabled={busy}
      >
        {isGeneratingPrompt && <span className="spinner spinner--small" />}
        {hasPrompt ? "Regenerate Prompt" : "Generate Prompt"}
      </button>
      <button
        className="soft-button"
        onClick={onGenerateImage}
        disabled={!hasPrompt || busy}
      >
        {isGeneratingImage && <span className="spinner spinner--small" />}
        {hasVariants ? "Generate Another" : "Generate Image"}
      </button>
      {hasVariants && entityType !== "room" && (
        <button
          className="soft-button"
          onClick={onRemoveBackground}
          disabled={busy}
        >
          {isRemovingBg && <span className="spinner spinner--small" />}
          Remove BG
        </button>
      )}
      {hasVariants && (
        <button
          className={`soft-button soft-button--success`}
          onClick={onApprove}
          disabled={isApproved || busy}
        >
          {isApproved ? "Approved" : "Approve"}
        </button>
      )}
    </div>
  );
}
