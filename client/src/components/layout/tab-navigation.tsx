interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs = [
    { id: "dashboard", label: "Dashboard", emoji: "🏠" },
    { id: "gestione", label: "Gestione", emoji: "📁" },
    { id: "routing", label: "Auto-Routing", emoji: "🤖" },
    { id: "onedrive", label: "OneDrive Browser", emoji: "☁️" },
    { id: "sistema", label: "Sistema", emoji: "⚙️" },
  ];

  return (
    <nav className="bg-g2-accent dark:bg-gray-800 border-b-2 border-primary" role="tablist" data-testid="tab-navigation">
      <div className="flex overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            data-testid={`tab-${tab.id}`}
          >
            <span className="text-xl">{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
