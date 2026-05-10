import { Link } from 'react-router';
import { useLanguage } from '@/hooks/useLanguage';
import { staticBlogs } from '@/lib/staticData';
import { Calendar, Eye, ArrowRight } from 'lucide-react';

export default function Timeline() {
  const { t } = useLanguage();
  const blogData = { items: staticBlogs };
  const isLoading = false;

  // Group blogs by year/month
  const items = blogData?.items ?? [];
  type BlogItem = typeof items[number];
  const grouped = items.reduce((acc: Record<string, BlogItem[]>, blog) => {
    const date = blog.createdAt ? new Date(blog.createdAt) : new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(blog);
    return acc;
  }, {} as Record<string, BlogItem[]>);

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="section-title text-[var(--flux-ink)] mb-4">
          <span className="gold-gradient-text">{t('nav.timeline')}</span>
        </h1>
        <p className="text-[var(--flux-ink-light)]">
          按时间顺序回顾每一篇文章，见证技术成长的轨迹。
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-[var(--flux-ink-light)]">{t('common.loading')}</div>
      ) : (
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-4 md:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-[var(--flux-gold)] via-[var(--flux-line)] to-transparent" />

          <div className="space-y-12">
            {sortedKeys.map((key) => {
              const [year, month] = key.split('-');
              const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
              return (
                <div key={key}>
                  {/* Month Header */}
                  <div className="flex items-center gap-4 mb-6 ml-4 md:ml-8">
                    <div className="w-3 h-3 rounded-full bg-[var(--flux-gold)] shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
                    <h2 className="text-xl font-bold text-[var(--flux-ink)]">
                      {year}年 {monthNames[Number(month) - 1]}
                    </h2>
                  </div>

                  {/* Blog Items */}
                  <div className="ml-8 md:ml-16 space-y-4">
                    {grouped[key]?.map((blog) => (
                      <Link
                        key={blog.id}
                        to={`/blog/${blog.id}`}
                        className="group block p-5 rounded-xl bg-[var(--flux-marble-dark)]/50 border border-[var(--flux-line)]/50 hover:border-[var(--flux-gold)]/30 transition-all hover:bg-[var(--flux-marble-dark)]/80"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-[var(--flux-ink)] group-hover:text-[var(--flux-gold)] transition-colors mb-2">
                              {blog.title}
                            </h3>
                            <p className="text-sm text-[var(--flux-ink-light)] line-clamp-2 mb-3">
                              {blog.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-[var(--flux-ink-light)]">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {blog.createdAt ? new Date(blog.createdAt).toLocaleDateString('zh-CN') : ''}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {blog.views}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-[var(--flux-ink-light)] group-hover:text-[var(--flux-gold)] group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
