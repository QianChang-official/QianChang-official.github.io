import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useLanguage } from '@/hooks/useLanguage';
import { getBlogWithRelations } from '@/lib/staticData';
import { ArrowLeft, Eye, Calendar, Tag, MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';

export default function BlogDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const blogId = Number(id);

  const [commentName, setCommentName] = useState('');
  const [commentEmail, setCommentEmail] = useState('');
  const [commentContent, setCommentContent] = useState('');

  const [blog, setBlog] = useState(() => getBlogWithRelations(blogId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLoading = false;

  useEffect(() => {
    setBlog(getBlogWithRelations(blogId));
  }, [blogId]);

  if (isLoading) {
    return <div className="pt-24 text-center text-[var(--flux-ink-light)]">{t('common.loading')}</div>;
  }

  if (!blog) {
    return (
      <div className="pt-24 text-center">
        <p className="text-[var(--flux-ink-light)] mb-4">文章不存在</p>
        <button onClick={() => navigate('/blog')} className="btn-gold">{t('common.back')}</button>
      </div>
    );
  }

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentName.trim() || !commentEmail.trim() || !commentContent.trim()) return;
    setIsSubmitting(true);
    setBlog((current) => current ? {
      ...current,
      comments: [
        ...(current.comments ?? []),
        {
          id: Date.now(),
          blogId,
          nickname: commentName,
          email: commentEmail,
          content: commentContent,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(commentName)}`,
          createdAt: new Date().toISOString(),
        },
      ],
    } : current);
    setCommentName('');
    setCommentEmail('');
    setCommentContent('');
    setIsSubmitting(false);
  };

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate('/blog')}
        className="flex items-center gap-2 text-sm text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('common.back')}
      </button>

      {/* Article Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4 text-xs text-[var(--flux-ink-light)]">
          {blog.type && (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--flux-gold)]/10 border border-[var(--flux-gold)]/30 text-[var(--flux-gold)]">
              <Tag className="w-3 h-3" />
              {blog.type.name}
            </span>
          )}
          {blog.flag && (
            <span className="px-2 py-1 rounded-full bg-[var(--flux-marble-dark)] border border-[var(--flux-line)]">
              {blog.flag}
            </span>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--flux-ink)] mb-4 leading-tight">
          {blog.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--flux-ink-light)]">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {blog.createdAt ? new Date(blog.createdAt).toLocaleDateString('zh-CN') : ''}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {blog.views} {t('blog.views')}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            {blog.comments?.length || 0} {t('blog.comments')}
          </span>
        </div>
      </div>

      {/* Featured Image */}
      {blog.firstPicture && (
        <div className="mb-10 rounded-xl overflow-hidden">
          <img src={blog.firstPicture} alt={blog.title} className="w-full h-auto" />
        </div>
      )}

      {/* Article Content */}
      <article className="prose prose-invert prose-lg max-w-none mb-16">
        <div className="text-[var(--flux-ink-light)] leading-[1.9] whitespace-pre-wrap">
          {blog.content}
        </div>
      </article>

      {/* Comments Section */}
      <div className="border-t border-[var(--flux-line)]/50 pt-12">
        <h3 className="text-xl font-semibold text-[var(--flux-ink)] mb-6 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-[var(--flux-gold)]" />
          评论 ({blog.comments?.length || 0})
        </h3>

        {/* Comment List */}
        <div className="space-y-6 mb-10">
          {blog.comments?.length === 0 && (
            <p className="text-[var(--flux-ink-light)] text-sm">暂无评论，来发表第一条评论吧！</p>
          )}
          {blog.comments?.map((comment) => (
            <div key={comment.id} className="flex gap-4 p-4 rounded-lg bg-[var(--flux-marble-dark)]/50 border border-[var(--flux-line)]/50">
              <img
                src={comment.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.nickname}`}
                alt=""
                className="w-10 h-10 rounded-full bg-[var(--flux-line)]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-[var(--flux-ink)]">{comment.nickname}</span>
                  <span className="text-xs text-[var(--flux-ink-light)]">
                    {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString('zh-CN') : ''}
                  </span>
                </div>
                <p className="text-sm text-[var(--flux-ink-light)]">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Comment Form */}
        <form onSubmit={handleSubmitComment} className="space-y-4 p-6 rounded-xl bg-[var(--flux-marble-dark)]/50 border border-[var(--flux-line)]/50">
          <h4 className="text-sm font-semibold text-[var(--flux-ink)]">发表评论</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              value={commentName}
              onChange={(e) => setCommentName(e.target.value)}
              placeholder="昵称 *"
              required
              className="px-4 py-3 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] placeholder:text-[var(--flux-ink-light)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm"
            />
            <input
              type="email"
              value={commentEmail}
              onChange={(e) => setCommentEmail(e.target.value)}
              placeholder="邮箱 *"
              required
              className="px-4 py-3 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] placeholder:text-[var(--flux-ink-light)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm"
            />
          </div>
          <textarea
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            placeholder="写下你的评论..."
            required
            rows={4}
            className="w-full px-4 py-3 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] placeholder:text-[var(--flux-ink-light)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm resize-none"
          />
          <button type="submit" className="btn-gold flex items-center gap-2" disabled={isSubmitting}>
            <Send className="w-4 h-4" />
            {isSubmitting ? '提交中...' : '发表评论'}
          </button>
        </form>
      </div>
    </div>
  );
}
