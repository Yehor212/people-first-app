import type { ReactNode } from "react";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { PanelLayout, LayoutPanel, ResizeHandle } from "./PanelLayout";

interface MasterDetailProps {
  master: ReactNode;
  detail: ReactNode;
  showDetail: boolean;
  masterSize?: number;
  autoSaveId?: string;
}

export function MasterDetail({
  master,
  detail,
  showDetail,
  masterSize = 30,
  autoSaveId,
}: MasterDetailProps) {
  const { supportsMultiPanel } = useDeviceTier();

  if (!supportsMultiPanel) {
    return <>{showDetail ? detail : master}</>;
  }

  return (
    <PanelLayout autoSaveId={autoSaveId}>
      <LayoutPanel defaultSize={masterSize} minSize={20} maxSize={50}>
        {master}
      </LayoutPanel>
      <ResizeHandle />
      <LayoutPanel defaultSize={100 - masterSize} maxSize={85}>
        {detail}
      </LayoutPanel>
    </PanelLayout>
  );
}
