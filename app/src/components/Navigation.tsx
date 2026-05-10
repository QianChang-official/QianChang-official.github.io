import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import {
  Sun, Moon, Menu, X, Globe, LayoutDashboard,
  Music, FolderGit2, UsersRound,
  FileText, Clock, Image, MessageSquare, Link as LinkIcon, User
} from 'lucide-react';

export default function Navigation() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const navLinks = [
    { to: '/blog', label: t('nav.blog'), icon: FileText },
    { to: '/timeline', label: t('nav.timeline'), icon: Clock },
    { to: '/gallery', label: t('nav.gallery'), icon: Image },
    { to: '/messages', label: t('nav.messages'), icon: MessageSquare },
    { to: '/friends', label: t('nav.friends'), icon: LinkIcon },
    { to: '/about', label: t('nav.about'), icon: User },
  ];

  const externalLinks = [
    { href: 'https://pub-ae8ff9e688d7481da1eab0ed3dd2a2fd.r2.dev', label: '音源', icon: Music },
    { href: 'https://github.com/QianChang-official?tab=repositories', label: '项目', icon: FolderGit2 },
    { href: 'https://github.com/QianChang-official', label: '社区', icon: UsersRound },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-500 ${
        scrolled ? 'nav-scrolled' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-xl md:text-2xl font-black gold-gradient-text tracking-tighter">
              流境
            </span>
            <span className="hidden sm:inline text-xs tracking-widest uppercase transition-colors"
              style={{ color: 'var(--flux-ink-light)' }}>
              Flux
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-all duration-300 ${
                  isActive(link.to)
                    ? 'text-[var(--flux-gold)] bg-[var(--flux-gold)]/10'
                    : 'text-[var(--flux-ink-light)] hover:text-[var(--flux-ink)] hover:bg-black/5'
                }`}
              >
                <link.icon className="w-3.5 h-3.5" />
                {link.label}
              </Link>
            ))}
            {externalLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:bg-black/5 transition-all duration-300"
              >
                <link.icon className="w-3.5 h-3.5" />
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              className="p-2 rounded-lg text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:bg-black/5 transition-colors"
              title="Switch Language"
            >
              <Globe className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:bg-black/5 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              to="/admin"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 btn-gold"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="text-xs">{t('nav.dashboard')}</span>
            </Link>
            <Link
              to="/admin"
              className="sm:hidden p-2 text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] transition-colors rounded-lg hover:bg-black/5"
              title={t('nav.dashboard')}
            >
              <LayoutDashboard className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-[var(--flux-ink-light)] hover:text-[var(--flux-ink)] transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden glass-panel border-t border-[var(--flux-line)]">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm transition-all ${
                  isActive(link.to)
                    ? 'text-[var(--flux-gold)] bg-[var(--flux-gold)]/10'
                    : 'text-[var(--flux-ink-light)] hover:text-[var(--flux-ink)] hover:bg-black/5'
                }`}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            ))}
            {externalLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:bg-black/5 transition-all"
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </a>
            ))}
            <Link
              to="/admin"
              className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--flux-gold)] bg-[var(--flux-gold)]/10 rounded-lg"
            >
              <LayoutDashboard className="w-4 h-4" />
              {t('nav.dashboard')}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
