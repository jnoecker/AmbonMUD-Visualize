import { useEffect, useState } from "react";
import type { ImageVariant } from "../../types/project";

interface VariantStripProps {
  variants: ImageVariant[];
  selectedIndex: number;
  approvedIndex: number | null;
  onSelect: (index: number) => void;
  getDataUrl: (filename: string) => Promise<string>;
}

export function VariantStrip({
  variants,
  selectedIndex,
  approvedIndex,
  onSelect,
  getDataUrl,
}: VariantStripProps) {
  if (variants.length === 0) return null;

  return (
    <div className="variant-strip">
      {variants.map((variant, i) => (
        <VariantThumb
          key={variant.filename}
          variant={variant}
          index={i}
          selected={i === selectedIndex}
          approved={i === approvedIndex}
          onClick={() => onSelect(i)}
          getDataUrl={getDataUrl}
        />
      ))}
    </div>
  );
}

function VariantThumb({
  variant,
  index,
  selected,
  approved,
  onClick,
  getDataUrl,
}: {
  variant: ImageVariant;
  index: number;
  selected: boolean;
  approved: boolean;
  onClick: () => void;
  getDataUrl: (filename: string) => Promise<string>;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDataUrl(variant.filename).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [variant.filename, getDataUrl]);

  const cls = [
    "variant-thumb",
    selected && "variant-thumb--selected",
    approved && "variant-thumb--approved",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} onClick={onClick} title={`v${index + 1} - ${variant.generatedAt}`}>
      {src ? (
        <img src={src} alt={`Variant ${index + 1}`} />
      ) : (
        <div className="spinner spinner--small" style={{ margin: "auto" }} />
      )}
    </div>
  );
}
