import { useCallback, useRef } from "react";

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin?: boolean;
}

export default function TabNavigation({ activeTab, onTabChange, isAdmin = true }: TabNavigationProps) {
  const allTabs = [
    { id: "dashboard", label: "Dashboard", emoji: "🏠", adminOnly: false },
    { id: "gestione", label: "Gestione", emoji: "📁", adminOnly: false },
    { id: "todo", label: "To Do", emoji: "✅", adminOnly: false },
    { id: "scadenze", label: "Scadenze", emoji: "📅", adminOnly: false },
    { id: "fatturazione", label: "Fatturazione", emoji: "📊", adminOnly: true },
    { id: "revisione-ai", label: "Revisione AI", emoji: "🧠", adminOnly: true },
    { id: "sistema", label: "Sistema", emoji: "⚙️", adminOnly: true },
  ];

  const tabs = allTabs.filter(tab => !tab.adminOnly || isAdmin);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    let nextIndex = currentIndex;

    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const nextTab = tabs[nextIndex];
    onTabChange(nextTab.id);
    tabRefs.current.get(nextTab.id)?.focus();
  }, [activeTab, tabs, onTabChange]);

  return (
    <nav className="bg-g2-accent dark:bg-gray-800 border-b-2 border-primary" role="tablist" aria-label="Sezioni principali" data-testid="tab-navigation" onKeyDown={handleKeyDown}>
      <div className="flex overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => { if (el) tabRefs.current.set(tab.id, el); }}
            id={`tab-${tab.id}`}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            data-testid={`tab-${tab.id}`}
          >
            <span className="text-xl" aria-hidden="true">{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
