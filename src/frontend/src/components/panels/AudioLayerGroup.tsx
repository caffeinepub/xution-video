import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { AudioLayerPanel } from "./AudioLayerPanel";

const AUDIO_IDS = [1, 2, 3, 4] as const;

export function AudioLayerGroup() {
  return (
    <div className="flex flex-col gap-1 font-mono">
      {AUDIO_IDS.map((id) => (
        <CollapsiblePanel key={id} title={`AUDIO ${id}`} defaultOpen={id === 1}>
          <AudioLayerPanel audioId={id} />
        </CollapsiblePanel>
      ))}
    </div>
  );
}
