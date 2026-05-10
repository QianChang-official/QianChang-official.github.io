import { useState } from 'react';
import { Link } from 'react-router';
import { useLanguage } from '@/hooks/useLanguage';
import { staticBlogs, staticTypes } from '@/lib/staticData';
import { Search, Eye, Calendar } from 'lucide-react';

export default function Blog() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<number | undefined>();
  const [page, setPage] = useState(1);

  const pageSize = 9;
  const typesData = staticTypes;
  const filteredBlogs = staticBlogs.filter((blog) => {
    const matchesKeyword = search
      ? `${blog.title} ${blog.description}`.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesType = selectedType ? blog.typeId === selectedType : true;
    return matchesKeyword && matchesType;
  });
  const blogData = {
    items: filteredBlogs.slice((page - 1) * pageSize, page * pageSize),
    total: filteredBlogs.length,
  };
  const isLoading = false;

  const totalPages = Math.ceil(blogData.total / pageSize);

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <h1 className="section-title text-[var(--flux-ink)] mb-4">
          <span className="gold-gradient-text">{t('blog.title')}</span>
        </h1>
        <p className="text-[var(--flux-ink-light)] max-w-xl">
          探索技术的深度，记录思维的轨迹。每一篇文章都是一次与未知对话的旅程。
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-10">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--flux-ink-light)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('blog.search')}
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] placeholder:text-[var(--flux-ink-light)] focus:outline-none focus:border-[var(--flux-gold)]/50 focus:ring-1 focus:ring-[var(--flux-gold)]/20 transition-all text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setSelectedType(undefined); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${
              !selectedType ? 'bg-[var(--flux-gold)] text-[var(--flux-marble)] font-medium' : 'bg-[var(--flux-marble-dark)] text-[var(--flux-ink-light)] border border-[var(--flux-line)] hover:border-[var(--flux-gold)]/30'
            }`}
          >
            {t('blog.allCategories')}
          </button>
          {typesData?.map((type) => (
            <button
              key={type.id}
              onClick={() => { setSelectedType(type.id); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                selectedType === type.id ? 'bg-[var(--flux-gold)] text-[var(--flux-marble)] font-medium' : 'bg-[var(--flux-marble-dark)] text-[var(--flux-ink-light)] border border-[var(--flux-line)] hover:border-[var(--flux-gold)]/30'
              }`}
            >
              {type.name}
            </button>
          ))}
        </div>
      </div>

      {/* Blog Grid */}
      {isLoading ? (
        <div className="text-center py-20 text-[var(--flux-ink-light)]">{t('common.loading')}</div>
      ) : blogData?.items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[var(--flux-ink-light)] text-lg">{t('blog.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogData?.items.map((blog) => (
            <Link
              key={blog.id}
              to={`/blog/${blog.id}`}
              className="group card-luxury overflow-hidden block"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={blog.firstPicture || '/assets/grid-art-light.jpg'}
                  alt={blog.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--flux-marble-dark)] via-transparent to-transparent" />
                {blog.flag && (
                  <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-[var(--flux-gold)]/20 border border-[var(--flux-gold)]/30 text-[var(--flux-gold)] text-xs">
                    {blog.flag}
                  </span>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3 text-xs text-[var(--flux-ink-light)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {blog.createdAt ? new Date(blog.createdAt).toLocaleDateString('zh-CN') : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {blog.views}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-[var(--flux-ink)] group-hover:text-[var(--flux-gold)] transition-colors mb-2 line-clamp-2">
                  {blog.title}
                </h3>
                <p className="text-sm text-[var(--flux-ink-light)] line-clamp-2 leading-relaxed">
                  {blog.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                page === p
                  ? 'bg-[var(--flux-gold)] text-[var(--flux-marble)]'
                  : 'bg-[var(--flux-marble-dark)] text-[var(--flux-ink-light)] border border-[var(--flux-line)] hover:border-[var(--flux-gold)]/30'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
