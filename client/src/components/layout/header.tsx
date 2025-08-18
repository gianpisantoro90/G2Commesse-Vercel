import logoUrl from "@assets/G2 - Logo_1755532156423.png";

export default function Header() {
  return (
    <header className="bg-white border-b-2 border-primary sticky top-0 z-50 shadow-sm" data-testid="header">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Brand Logo */}
            <img 
              src={logoUrl} 
              alt="G2 Ingegneria Logo" 
              className="w-12 h-12 rounded-xl shadow-lg object-contain" 
              data-testid="brand-logo"
            />
            <div>
              <h1 className="text-xl font-bold text-primary tracking-tight" data-testid="brand-title">
                G2 Ingegneria
              </h1>
              <p className="text-sm text-gray-500" data-testid="brand-subtitle">
                Sistema Gestione Commesse
              </p>
            </div>
          </div>
          

        </div>
      </div>
    </header>
  );
}
