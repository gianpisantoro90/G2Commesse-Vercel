interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin?: boolean;
}

export default function TabNavigation({ activeTab, onTabChange, isAdmin = true }: TabNavigationProps) {
  const allTabs = [
    { id: "dashboard", label: "Dashboard", emoji: "🏠", adminOnly: false },
    { id: "gestione", label: "Gestione", emoji: "📁", adminOnly: false },
    { id: "routing", label: "Auto-Routing", emoji: "🤖", adminOnly: true },
    { id: "onedrive", label: "OneDrive Browser", emoji: "☁️", adminOnly: true },
    { id: "sistema", label: "Sistema", emoji: "⚙️", adminOnly: true },
  ];

  // Filter tabs based on user role
  const tabs = allTabs.filter(tab => !tab.adminOnly || isAdmin);

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
