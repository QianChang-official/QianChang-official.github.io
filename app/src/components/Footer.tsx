import { useLanguage } from '@/hooks/useLanguage';
import { Link } from 'react-router';
import { Github, Twitter, Mail, Heart } from 'lucide-react';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="relative z-10 border-t border-[var(--flux-line)]/50 bg-[var(--flux-marble)]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="text-2xl font-black gold-gradient-text">流境</h3>
            <p className="text-sm text-[var(--flux-ink-light)] leading-relaxed max-w-xs">
              在数据深渊中探索未知的边界，记录技术之旅的每一个灵感瞬间。
            </p>
            <div className="flex items-center gap-3">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:border-[var(--flux-gold)]/30 transition-all">
                <Github className="w-4 h-4" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:border-[var(--flux-gold)]/30 transition-all">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="mailto:hello@flux.zone"
                className="p-2 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:border-[var(--flux-gold)]/30 transition-all">
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--flux-ink)] mb-4">导航</h4>
            <ul className="space-y-2">
              {[
                { to: '/blog', label: t('nav.blog') },
                { to: '/timeline', label: t('nav.timeline') },
                { to: '/gallery', label: t('nav.gallery') },
                { to: '/messages', label: t('nav.messages') },
                { to: '/friends', label: t('nav.friends') },
              ].map(link => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] transition-colors link-gold">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--flux-ink)] mb-4">联系</h4>
            <p className="text-sm text-[var(--flux-ink-light)]">hello@flux.zone</p>
            <p className="text-sm text-[var(--flux-ink-light)] mt-1">Digital Realm, Earth</p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[var(--flux-line)]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--flux-ink-light)]">
            &copy; 2026 {t('footer.copyright')}
          </p>
          <p className="text-xs text-[var(--flux-ink-light)] flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-[var(--flux-gold)]" /> and lots of
            <span className="gold-gradient-text font-medium"> code</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
