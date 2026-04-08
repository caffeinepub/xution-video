import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { PiPPanel } from "./PiPPanel";

const PIP_IDS = [1, 2, 3, 4] as const;

export function PiPPanelsGroup() {
  return (
    <>
      {PIP_IDS.map((id) => (
        <CollapsiblePanel
          key={`pip-${id}`}
          title={`PiP ${id}`}
          defaultOpen={id === 1}
        >
          <PiPPanel pipId={id} />
        </CollapsiblePanel>
      ))}
    </>
  );
}
