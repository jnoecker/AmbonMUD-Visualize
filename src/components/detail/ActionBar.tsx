import type { EntityType } from "../../types/entities";

interface ActionBarProps {
  hasPrompt: boolean;
  hasVariants: boolean;
  isApproved: boolean;
  isGeneratingPrompt: boolean;
  isGeneratingImage: boolean;
  imageJobProgress?: { total: number; completed: number };
  isRemovingBg: boolean;
  isFlipping?: boolean;
  entityType: EntityType;
  onGeneratePrompt: () => void;
  onGenerateImage: () => void;
  onGenerateMultiImage?: () => void;
  onApprove: () => void;
  onRemoveBackground: () => void;
  onFlipHorizontal?: () => void;
}

export function ActionBar({
  hasPrompt,
  hasVariants,
  isApproved,
  isGeneratingPrompt,
  isGeneratingImage,
  imageJobProgress,
  isRemovingBg,
  isFlipping,
  entityType,
  onGeneratePrompt,
  onGenerateImage,
  onGenerateMultiImage,
  onApprove,
  onRemoveBackground,
  onFlipHorizontal,
}: ActionBarProps) {
  const busy = isGeneratingPrompt || isGeneratingImage || isRemovingBg || !!isFlipping;

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
      {onGenerateMultiImage && (
        <button
          className="soft-button"
          onClick={onGenerateMultiImage}
          disabled={!hasPrompt || busy}
        >
          {isGeneratingImage && <span className="spinner spinner--small" />}
          {isGeneratingImage && imageJobProgress
            ? `${imageJobProgress.completed}/${imageJobProgress.total}`
            : "Generate 4"}
        </button>
      )}
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
      {hasVariants && onFlipHorizontal && (
        <button
          className="soft-button"
          onClick={onFlipHorizontal}
          disabled={busy}
        >
          {isFlipping && <span className="spinner spinner--small" />}
          Flip ↔
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
