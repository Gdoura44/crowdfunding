import { useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { useUnreadNotifications } from "../hooks/useUnreadNotifications.js";
import {
  Home, Compass, LineChart, Shield, Layers, Bell,
  Coins, MessageSquare, Building2, Sparkles, User,
  IdCard, Flag, LogOut, Menu, X, ChevronDown
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

function navClass({ isActive }) {
  return `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
    isActive
      ? "bg-primary/15 text-primary font-semibold shadow-sm"
      : "text-foreground/70 hover:bg-primary/8 hover:text-primary"
  }`;
}

function NavDropdown({ title, icon: Icon, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground/70 hover:bg-primary/8 hover:text-primary transition-all duration-200"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Icon className="w-4 h-4" />
        <span>{title}</span>
        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-1 w-56 bg-popover/95 backdrop-blur rounded-xl shadow-lg border border-border/50 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}


function DropdownItem({ to, icon: Icon, onClick, children, danger, textClass }) {
  const baseClass = `flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left transition-colors rounded-md mx-1 w-[calc(100%-8px)] hover:bg-primary/8 ${
    danger ? "text-destructive hover:text-destructive hover:bg-destructive/8" : "text-foreground/80 hover:text-primary"
  }`;
  if (onClick) return (
    <button onClick={onClick} className={baseClass}>
      {Icon && <Icon className="w-4 h-4" />}
      <span className={textClass}>{children}</span>
    </button>
  );
  if (to) return (
    <Link to={to} className={baseClass}>
      {Icon && <Icon className="w-4 h-4" />}
      <span className={textClass}>{children}</span>
    </Link>
  );
  return (
    <div className={baseClass}>
      {Icon && <Icon className="w-4 h-4" />}
      <span className={textClass}>{children}</span>
    </div>
  );
}

export default function Layout() {
  const { user, loading, logout, isAuthenticated } = useAuth();
  const userKey = user?.id || user?._id;
  const unread = useUnreadNotifications({ enabled: Boolean(isAuthenticated && userKey) });
  const displayName = user?.profile?.firstName?.trim() || user?.email?.split("@")[0] || "Compte";

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setIsMobileMenuOpen(false); }, [location.pathname]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
      <a className="sr-only focus:not-sr-only focus:absolute focus:p-4 focus:bg-background focus:z-50" href="#main-content">
        Aller au contenu
      </a>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 w-full">
        {/* Gradient top accent bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-primary via-[oklch(0.60_0.11_210)] to-primary/40" />

        <div className="bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 border-b border-border/50 shadow-sm">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">

              {/* Logo */}
              <div className="flex-shrink-0">
                <Link className="flex items-center gap-2.5 group" to="/">
                  <div className="flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.60_0.11_210)] text-white font-black h-9 w-9 text-xs shadow-md group-hover:shadow-lg transition-shadow duration-300">
                    FC
                  </div>
                  <span className="font-bold text-lg tracking-tight text-foreground">
                    Fin<span className="fc-gradient-text">Collab</span>
                  </span>
                </Link>
              </div>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1">
                <NavLink className={navClass} to="/" end>
                  <Home className="w-4 h-4" /><span>Accueil</span>
                </NavLink>
                <NavLink className={navClass} to="/projects">
                  <Compass className="w-4 h-4" /><span>Explorer</span>
                </NavLink>

                {!loading && isAuthenticated && (
                  <>
                    {user?.role === "EXPERT" && (
                      <NavDropdown title="Expert" icon={LineChart}>
                        <DropdownItem to="/expert/projects">Dossiers à analyser</DropdownItem>
                        <DropdownItem to="/expert/consultations">Consultations</DropdownItem>
                      </NavDropdown>
                    )}

                    {user?.role === "ADMIN" && (
                      <NavDropdown title="Admin" icon={Shield}>
                        <DropdownItem to="/admin/projects">Projets</DropdownItem>
                        <DropdownItem to="/admin/users">Utilisateurs</DropdownItem>
                        <DropdownItem to="/admin/experts">Gestion des Experts</DropdownItem>
                        <DropdownItem to="/admin/reports">Signalements</DropdownItem>
                        <DropdownItem to="/admin/comments">Commentaires</DropdownItem>
                        <DropdownItem to="/admin/payouts">Payouts</DropdownItem>
                        <DropdownItem to="/admin/ops">Ops</DropdownItem>
                        <DropdownItem to="/admin/email-failures">Échecs d'e-mail</DropdownItem>
                      </NavDropdown>
                    )}

                    {user?.role !== "ADMIN" && user?.role !== "EXPERT" && (
                      <NavLink className={navClass} to="/dashboard">
                        <Layers className="w-4 h-4" /><span>Mes projets</span>
                      </NavLink>
                    )}

                    {/* Notifications bell */}
                    <NavLink className={navClass} to="/notifications">
                      <div className="relative flex items-center justify-center">
                        <Bell className="w-4 h-4" />
                        {unread > 0 && (
                          <span className="absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-orange-500 px-1 text-[10px] font-bold text-white shadow-sm">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </div>
                      <span>Notifications</span>
                    </NavLink>

                    {user?.role !== "ADMIN" && user?.role !== "EXPERT" && (
                      <>
                        <NavLink className={navClass} to="/investments">
                          <Coins className="w-4 h-4" /><span>Investissements</span>
                        </NavLink>
                        <NavLink className={navClass} to="/consultations">
                          <MessageSquare className="w-4 h-4" /><span>Consultations</span>
                        </NavLink>
                        <NavLink className={navClass} to="/payouts">
                          <Building2 className="w-4 h-4" /><span>Payouts</span>
                        </NavLink>
                        <NavLink className={navClass} to="/recommendations">
                          <Sparkles className="w-4 h-4" /><span>Recommandations</span>
                        </NavLink>
                      </>
                    )}

                    {/* Profile dropdown */}
                    <div className="ml-2 pl-2 border-l border-border">
                      <NavDropdown title={displayName} icon={User}>
                        <div className="px-3 py-2.5 border-b border-border/50 mb-1">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[oklch(0.60_0.11_210)] flex items-center justify-center text-white text-xs font-bold mb-1.5">
                            {displayName[0]?.toUpperCase()}
                          </div>
                          <p className="text-sm font-semibold truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </div>
                        <DropdownItem to="/profile" icon={IdCard}>Mon profil</DropdownItem>
                        {user?.role !== "ADMIN" && user?.role !== "EXPERT" && (
                          <DropdownItem to="/reports" icon={Flag}>Mes signalements</DropdownItem>
                        )}
                        {user?.role === "ADMIN" && (
                          <DropdownItem icon={Shield} textClass="text-primary font-medium">Administrateur</DropdownItem>
                        )}
                        {user?.role === "EXPERT" && (
                          <DropdownItem icon={LineChart} textClass="text-primary font-medium">Expert financier</DropdownItem>
                        )}
                        <div className="my-1 border-t border-border/50" />
                        <DropdownItem icon={LogOut} danger onClick={() => logout()}>Déconnexion</DropdownItem>
                      </NavDropdown>
                    </div>
                  </>
                )}

                {!loading && !isAuthenticated && (
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/login">Connexion</Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link to="/register">Inscription</Link>
                    </Button>
                  </div>
                )}
              </nav>

              {/* Mobile menu button */}
              <div className="flex items-center md:hidden">
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-border/50 bg-background shadow-lg animate-in slide-in-from-top-2 duration-200">
              <div className="px-3 pt-3 pb-5 space-y-1">
                <NavLink className={navClass} to="/" end><Home className="w-4 h-4" /> Accueil</NavLink>
                <NavLink className={navClass} to="/projects"><Compass className="w-4 h-4" /> Explorer</NavLink>

                {!loading && isAuthenticated && (
                  <>
                    <div className="py-2 border-t border-border/50 mt-2">
                      <p className="px-3 text-[10px] font-bold text-primary/70 uppercase tracking-widest mb-2">Mon Compte</p>
                      <NavLink className={navClass} to="/profile"><IdCard className="w-4 h-4" /> Mon profil</NavLink>
                      <NavLink className={navClass} to="/notifications">
                        <Bell className="w-4 h-4" /> Notifications
                        {unread > 0 && <span className="ml-auto bg-gradient-to-r from-rose-500 to-orange-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">{unread}</span>}
                      </NavLink>
                    </div>

                    {user?.role === "EXPERT" && (
                      <div className="py-2 border-t border-border/50">
                        <p className="px-3 text-[10px] font-bold text-primary/70 uppercase tracking-widest mb-2">Expert</p>
                        <NavLink className={navClass} to="/expert/projects"><LineChart className="w-4 h-4" /> Dossiers à analyser</NavLink>
                        <NavLink className={navClass} to="/expert/consultations"><MessageSquare className="w-4 h-4" /> Consultations</NavLink>
                      </div>
                    )}

                    {user?.role === "ADMIN" && (
                      <div className="py-2 border-t border-border/50">
                        <p className="px-3 text-[10px] font-bold text-primary/70 uppercase tracking-widest mb-2">Admin</p>
                        <NavLink className={navClass} to="/admin/projects"><Shield className="w-4 h-4" /> Projets</NavLink>
                        <NavLink className={navClass} to="/admin/users"><User className="w-4 h-4" /> Utilisateurs</NavLink>
                        <NavLink className={navClass} to="/admin/experts"><Shield className="w-4 h-4" /> Experts</NavLink>
                        <NavLink className={navClass} to="/admin/reports"><Flag className="w-4 h-4" /> Signalements</NavLink>
                        <NavLink className={navClass} to="/admin/payouts"><Building2 className="w-4 h-4" /> Payouts</NavLink>
                      </div>
                    )}

                    {user?.role !== "ADMIN" && user?.role !== "EXPERT" && (
                      <div className="py-2 border-t border-border/50">
                        <p className="px-3 text-[10px] font-bold text-primary/70 uppercase tracking-widest mb-2">Investisseur &amp; Porteur</p>
                        <NavLink className={navClass} to="/dashboard"><Layers className="w-4 h-4" /> Mes projets</NavLink>
                        <NavLink className={navClass} to="/investments"><Coins className="w-4 h-4" /> Mes investissements</NavLink>
                        <NavLink className={navClass} to="/consultations"><MessageSquare className="w-4 h-4" /> Mes consultations</NavLink>
                        <NavLink className={navClass} to="/payouts"><Building2 className="w-4 h-4" /> Mes payouts</NavLink>
                        <NavLink className={navClass} to="/recommendations"><Sparkles className="w-4 h-4" /> Recommandations</NavLink>
                      </div>
                    )}

                    <div className="py-2 border-t border-border/50 mt-1">
                      <button onClick={() => logout()} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/8 transition-colors rounded-lg">
                        <LogOut className="w-4 h-4" /> Déconnexion
                      </button>
                    </div>
                  </>
                )}

                {!loading && !isAuthenticated && (
                  <div className="py-3 border-t border-border/50 flex flex-col gap-2 px-1 mt-2">
                    <Button variant="outline" className="w-full" asChild><Link to="/login">Connexion</Link></Button>
                    <Button className="w-full" asChild><Link to="/register">Inscription</Link></Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="border-t border-border/40 py-8" style={{ background: "linear-gradient(to right, oklch(0.15 0.03 215 / 0.04), transparent)" }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-[oklch(0.60_0.11_210)] flex items-center justify-center text-white text-[10px] font-black">FC</div>
            <span>© {new Date().getFullYear()} FinCollab. Tous droits réservés.</span>
          </div>
          <p className="font-medium text-primary/60">Plateforme de financement collaboratif agréée</p>
        </div>
      </footer>

      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
