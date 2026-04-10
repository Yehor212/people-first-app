import { memo, useState, useEffect } from "react";
import { Sidebar } from "@/components/navigation/Sidebar";
import { BottomTabs } from "@/components/navigation/BottomTabs";

type TabType = "home" | "garden" | "stats" | "achievements" | "settings" | "mindmap";

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  canvasEnabled?: boolean;
  habitHubEnabled?: boolean;
}

export const Navigation = memo(function Navigation({
  activeTab,
  onTabChange,
  canvasEnabled,
  habitHubEnabled,
}: NavigationProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Hide mobile nav when software keyboard is open
  useEffect(() => {
    const threshold = window.screen.height * 0.75;
    const onResize = () => setKeyboardOpen(window.innerHeight < threshold);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const tabProps = { activeTab, onTabChange, canvasEnabled, habitHubEnabled };

  return (
    <>
      <Sidebar {...tabProps} />
      {!keyboardOpen && <BottomTabs {...tabProps} />}
    </>
  );
});
