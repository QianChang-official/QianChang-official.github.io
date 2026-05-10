import { useLanguage } from '@/hooks/useLanguage';
import { staticFriends } from '@/lib/staticData';
import { ExternalLink, Users, Globe } from 'lucide-react';

export default function Friends() {
  const { t } = useLanguage();
  const friends = staticFriends;
  const isLoading = false;

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="section-title text-[var(--flux-ink)] mb-4">
          <span className="gold-gradient-text">{t('friends.title')}</span>
        </h1>
        <p className="text-[var(--flux-ink-light)] max-w-xl mx-auto">{t('friends.subtitle')}</p>
      </div>

      {/* Friends Grid */}
      {isLoading ? (
        <div className="text-center py-20 text-[var(--flux-ink-light)]">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {friends?.map((friend) => (
            <a
              key={friend.id}
              href={friend.blogAddress}
              target="_blank"
              rel="noopener noreferrer"
              className="group card-luxury overflow-hidden block"
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  src={friend.pictureAddress}
                  alt={friend.blogName}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--flux-marble-dark)] via-transparent to-transparent" />
                <div className="absolute top-3 right-3 p-1.5 rounded-full bg-[var(--flux-gold)]/20 border border-[var(--flux-gold)]/30 text-[var(--flux-gold)] opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="w-3 h-3" />
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-base font-semibold text-[var(--flux-ink)] group-hover:text-[var(--flux-gold)] transition-colors mb-1">
                  {friend.blogName}
                </h3>
                <p className="text-xs text-[var(--flux-ink-light)] truncate flex items-center gap-1">
                  <Globe className="w-3 h-3 flex-shrink-0" />
                  {friend.blogAddress}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Apply for friend link */}
      <div className="mt-16 p-8 rounded-2xl glass-panel gold-border-glow text-center max-w-2xl mx-auto">
        <Users className="w-10 h-10 text-[var(--flux-gold)] mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-[var(--flux-ink)] mb-2">交换友情链接</h3>
        <p className="text-sm text-[var(--flux-ink-light)] mb-4">
          如果你也有个人博客或技术站点，欢迎在留言板留下你的站点信息，我会尽快添加友链。
        </p>
        <p className="text-xs text-[var(--flux-ink-light)]">
          站点要求：原创内容、技术相关、定期更新
        </p>
      </div>
    </div>
  );
}
