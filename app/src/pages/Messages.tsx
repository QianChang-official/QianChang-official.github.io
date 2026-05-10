import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { staticMessages } from '@/lib/staticData';
import { Send, MessageSquare, Clock } from 'lucide-react';

export default function Messages() {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');

  const [messages, setMessages] = useState(staticMessages);
  const isLoading = false;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !content.trim()) return;
    setIsSubmitting(true);
    setMessages((current) => [
      {
        id: Date.now(),
        nickname: name,
        email,
        content,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        createdAt: new Date().toISOString(),
        adminMessage: false,
      },
      ...current,
    ]);
    setName('');
    setEmail('');
    setContent('');
    setIsSubmitting(false);
  };

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="section-title text-[var(--flux-ink)] mb-4">
          <span className="gold-gradient-text">{t('messages.title')}</span>
        </h1>
        <p className="text-[var(--flux-ink-light)] max-w-xl mx-auto">{t('messages.subtitle')}</p>
      </div>

      {/* Message Form */}
      <form onSubmit={handleSubmit} className="mb-16 p-6 md:p-8 rounded-2xl glass-panel gold-border-glow">
        <h3 className="text-lg font-semibold text-[var(--flux-ink)] mb-6 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[var(--flux-gold)]" />
          {t('messages.submit')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-[var(--flux-ink-light)] mb-2">{t('messages.name')} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] placeholder:text-[var(--flux-ink-light)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--flux-ink-light)] mb-2">{t('messages.email')} *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] placeholder:text-[var(--flux-ink-light)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm text-[var(--flux-ink-light)] mb-2">{t('messages.content')} *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={5}
            placeholder={t('messages.placeholder')}
            className="w-full px-4 py-3 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] placeholder:text-[var(--flux-ink-light)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm resize-none"
          />
        </div>
        <button type="submit" className="btn-gold flex items-center gap-2" disabled={isSubmitting}>
          <Send className="w-4 h-4" />
          {isSubmitting ? '提交中...' : t('messages.submit')}
        </button>
      </form>

      {/* Messages List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[var(--flux-ink)] mb-6">
          全部留言 ({messages?.length || 0})
        </h3>

        {isLoading ? (
          <div className="text-center py-12 text-[var(--flux-ink-light)]">{t('common.loading')}</div>
        ) : messages?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--flux-ink-light)]">暂无留言，来留下第一条足迹吧！</p>
          </div>
        ) : (
          messages?.map((msg) => (
            <div
              key={msg.id}
              className="p-5 rounded-xl bg-[var(--flux-marble-dark)]/50 border border-[var(--flux-line)]/50 hover:border-[var(--flux-gold)]/20 transition-all"
            >
              <div className="flex items-start gap-4">
                <img
                  src={msg.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.nickname}`}
                  alt=""
                  className="w-10 h-10 rounded-full bg-[var(--flux-line)] flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-[var(--flux-ink)]">{msg.nickname}</span>
                    <span className="text-xs text-[var(--flux-ink-light)] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('zh-CN') : ''}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--flux-ink-light)] leading-relaxed">{msg.content}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
