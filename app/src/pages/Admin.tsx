import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLanguage } from '@/hooks/useLanguage';
import { trpc } from '@/providers/trpc';
import {
  LayoutDashboard, FileText, Tag, MessageSquare, Mail,
  Link as LinkIcon, Image, Trash2, Plus, X, Save,
  Eye, PanelLeftClose, PanelLeft
} from 'lucide-react';

type TabType = 'blogs' | 'types' | 'comments' | 'messages' | 'friends' | 'pictures';

export default function Admin() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('blogs');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'blog' | 'type' | 'friend' | 'picture'>('blog');
  const [, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, string | undefined>>({});

  const utils = trpc.useUtils();

  // Queries
  const { data: blogData } = trpc.blog.list.useQuery({ page: 1, pageSize: 50 });
  const { data: typesData } = trpc.type.list.useQuery();
  const { data: commentsData } = trpc.comment.listByBlog.useQuery({ blogId: 1 }, { enabled: activeTab === 'comments' });
  const { data: messagesData } = trpc.message.list.useQuery();
  const { data: friendsData } = trpc.friend.list.useQuery();
  const { data: picturesData } = trpc.picture.list.useQuery();

  // Mutations
  const deleteBlog = trpc.blog.delete.useMutation({ onSuccess: () => utils.blog.list.invalidate() });
  const deleteType = trpc.type.delete.useMutation({ onSuccess: () => utils.type.list.invalidate() });
  const deleteComment = trpc.comment.delete.useMutation({ onSuccess: () => utils.comment.listByBlog.invalidate({ blogId: 1 }) });
  const deleteMessage = trpc.message.delete.useMutation({ onSuccess: () => utils.message.list.invalidate() });
  const deleteFriend = trpc.friend.delete.useMutation({ onSuccess: () => utils.friend.list.invalidate() });
  const deletePicture = trpc.picture.delete.useMutation({ onSuccess: () => utils.picture.list.invalidate() });

  const createBlog = trpc.blog.create.useMutation({ onSuccess: () => { utils.blog.list.invalidate(); setShowModal(false); } });
  const createType = trpc.type.create.useMutation({ onSuccess: () => { utils.type.list.invalidate(); setShowModal(false); } });
  const createFriend = trpc.friend.create.useMutation({ onSuccess: () => { utils.friend.list.invalidate(); setShowModal(false); } });
  const createPicture = trpc.picture.create.useMutation({ onSuccess: () => { utils.picture.list.invalidate(); setShowModal(false); } });

  const openModal = (type: typeof modalType, id?: number) => {
    setModalType(type);
    setEditId(id || null);
    setFormData({});
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalType === 'blog') {
      createBlog.mutate({
        title: formData.title || '',
        content: formData.content || '',
        description: formData.description || undefined,
        firstPicture: formData.firstPicture || undefined,
        typeId: Number(formData.typeId) || 1,
      });
    } else if (modalType === 'type') {
      createType.mutate({ name: formData.name || '' });
    } else if (modalType === 'friend') {
      createFriend.mutate({
        blogName: formData.blogName || '',
        blogAddress: formData.blogAddress || '',
        pictureAddress: formData.pictureAddress || '',
      });
    } else if (modalType === 'picture') {
      createPicture.mutate({
        pictureAddress: formData.pictureAddress || '',
        pictureName: formData.pictureName || undefined,
        pictureDescription: formData.pictureDescription || undefined,
      });
    }
  };

  const tabs: { id: TabType; label: string; icon: typeof FileText }[] = [
    { id: 'blogs', label: t('admin.blogs'), icon: FileText },
    { id: 'types', label: t('admin.types'), icon: Tag },
    { id: 'comments', label: t('admin.comments'), icon: MessageSquare },
    { id: 'messages', label: t('admin.messages'), icon: Mail },
    { id: 'friends', label: t('admin.friends'), icon: LinkIcon },
    { id: 'pictures', label: t('admin.pictures'), icon: Image },
  ];

  const stats = [
    { label: t('admin.totalBlogs'), value: blogData?.total || 0, icon: FileText, color: 'from-[var(--flux-gold)] to-[var(--flux-gold-light)]' },
    { label: t('admin.totalComments'), value: commentsData?.length || 0, icon: MessageSquare, color: 'from-[#10b981] to-[#34d399]' },
    { label: t('admin.totalMessages'), value: messagesData?.length || 0, icon: Mail, color: 'from-[#3b82f6] to-[#60a5fa]' },
    { label: t('admin.totalFriends'), value: friendsData?.length || 0, icon: LinkIcon, color: 'from-[#f59e0b] to-[#fbbf24]' },
  ];

  return (
    <div className="pt-20 min-h-screen bg-[var(--flux-marble)]">
      <div className="flex">
        {/* Sidebar Collapse Toggle - visible when sidebar closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="hidden md:flex fixed left-4 top-24 z-50 p-2 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:border-[var(--flux-gold)]/30 transition-all"
            title="展开侧边栏"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} hidden md:flex w-64 flex-shrink-0 flex-col bg-[var(--flux-marble-dark)] border-r border-[var(--flux-line)]/50 min-h-screen fixed left-0 top-0 pt-20 pb-8 z-40 transition-transform duration-300`}>
          <div className="px-4 mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold gold-gradient-text flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5" />
              {t('admin.title')}
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:bg-black/5 transition-colors"
              title="收起侧边栏"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-[var(--flux-gold)]/10 text-[var(--flux-gold)] border border-[var(--flux-gold)]/20'
                    : 'text-[var(--flux-ink-light)] hover:text-[var(--flux-ink)] hover:bg-black/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <div className={`flex-1 p-4 sm:p-8 transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-0'}`}>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="card-luxury p-5">
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className="w-5 h-5 text-[var(--flux-gold)]" />
                  <span className="text-2xl font-bold text-[var(--flux-ink)]">{stat.value}</span>
                </div>
                <p className="text-xs text-[var(--flux-ink-light)]">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Tab Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[var(--flux-ink)]">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            {['blogs', 'types', 'friends', 'pictures'].includes(activeTab) && (
              <button
                onClick={() => openModal(activeTab as typeof modalType)}
                className="btn-gold flex items-center gap-2 text-sm py-2 px-4"
              >
                <Plus className="w-4 h-4" />
                新建
              </button>
            )}
          </div>

          {/* Blogs Table */}
          {activeTab === 'blogs' && (
            <div className="overflow-x-auto rounded-xl border border-[var(--flux-line)]/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--flux-marble-dark)]">
                    <th className="text-left px-4 py-3 text-[var(--flux-ink-light)] font-medium">标题</th>
                    <th className="text-left px-4 py-3 text-[var(--flux-ink-light)] font-medium hidden sm:table-cell">分类</th>
                    <th className="text-left px-4 py-3 text-[var(--flux-ink-light)] font-medium hidden md:table-cell">浏览</th>
                    <th className="text-left px-4 py-3 text-[var(--flux-ink-light)] font-medium hidden lg:table-cell">日期</th>
                    <th className="text-right px-4 py-3 text-[var(--flux-ink-light)] font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--flux-line)]/30">
                  {blogData?.items.map((blog) => (
                    <tr key={blog.id} className="hover:bg-[var(--flux-marble-dark)]/30 transition-colors">
                      <td className="px-4 py-3 text-[var(--flux-ink)]">{blog.title}</td>
                      <td className="px-4 py-3 text-[var(--flux-ink-light)] hidden sm:table-cell">{blog.flag || '-'}</td>
                      <td className="px-4 py-3 text-[var(--flux-ink-light)] hidden md:table-cell">{blog.views}</td>
                      <td className="px-4 py-3 text-[var(--flux-ink-light)] hidden lg:table-cell">
                        {blog.createdAt ? new Date(blog.createdAt).toLocaleDateString('zh-CN') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => navigate(`/blog/${blog.id}`)} className="p-1.5 rounded text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:bg-[var(--flux-gold)]/10 transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteBlog.mutate({ id: blog.id })} className="p-1.5 rounded text-[var(--flux-ink-light)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Types Table */}
          {activeTab === 'types' && (
            <div className="overflow-x-auto rounded-xl border border-[var(--flux-line)]/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--flux-marble-dark)]">
                    <th className="text-left px-4 py-3 text-[var(--flux-ink-light)] font-medium">ID</th>
                    <th className="text-left px-4 py-3 text-[var(--flux-ink-light)] font-medium">名称</th>
                    <th className="text-right px-4 py-3 text-[var(--flux-ink-light)] font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--flux-line)]/30">
                  {typesData?.map((type) => (
                    <tr key={type.id} className="hover:bg-[var(--flux-marble-dark)]/30 transition-colors">
                      <td className="px-4 py-3 text-[var(--flux-ink-light)]">{type.id}</td>
                      <td className="px-4 py-3 text-[var(--flux-ink)]">{type.name}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteType.mutate({ id: type.id })} className="p-1.5 rounded text-[var(--flux-ink-light)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Comments List */}
          {activeTab === 'comments' && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--flux-ink-light)] mb-4">提示：请到具体文章页面查看和管理评论</p>
              {commentsData?.map((comment) => (
                <div key={comment.id} className="flex items-start gap-4 p-4 rounded-xl bg-[var(--flux-marble-dark)]/50 border border-[var(--flux-line)]/50">
                  <img src={comment.avatar || ''} alt="" className="w-10 h-10 rounded-full bg-[var(--flux-line)]" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[var(--flux-ink)]">{comment.nickname}</span>
                      <span className="text-xs text-[var(--flux-ink-light)]">{comment.email}</span>
                    </div>
                    <p className="text-sm text-[var(--flux-ink-light)]">{comment.content}</p>
                  </div>
                  <button onClick={() => deleteComment.mutate({ id: comment.id })} className="p-1.5 rounded text-[var(--flux-ink-light)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Messages List */}
          {activeTab === 'messages' && (
            <div className="space-y-3">
              {messagesData?.map((msg) => (
                <div key={msg.id} className="flex items-start gap-4 p-4 rounded-xl bg-[var(--flux-marble-dark)]/50 border border-[var(--flux-line)]/50">
                  <img src={msg.avatar || ''} alt="" className="w-10 h-10 rounded-full bg-[var(--flux-line)]" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[var(--flux-ink)]">{msg.nickname}</span>
                      <span className="text-xs text-[var(--flux-ink-light)]">{msg.email}</span>
                      {msg.adminMessage && <span className="px-2 py-0.5 rounded-full bg-[var(--flux-gold)]/10 text-[var(--flux-gold)] text-xs">管理员</span>}
                    </div>
                    <p className="text-sm text-[var(--flux-ink-light)]">{msg.content}</p>
                  </div>
                  <button onClick={() => deleteMessage.mutate({ id: msg.id })} className="p-1.5 rounded text-[var(--flux-ink-light)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Friends Table */}
          {activeTab === 'friends' && (
            <div className="overflow-x-auto rounded-xl border border-[var(--flux-line)]/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--flux-marble-dark)]">
                    <th className="text-left px-4 py-3 text-[var(--flux-ink-light)] font-medium">名称</th>
                    <th className="text-left px-4 py-3 text-[var(--flux-ink-light)] font-medium hidden sm:table-cell">地址</th>
                    <th className="text-right px-4 py-3 text-[var(--flux-ink-light)] font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--flux-line)]/30">
                  {friendsData?.map((friend) => (
                    <tr key={friend.id} className="hover:bg-[var(--flux-marble-dark)]/30 transition-colors">
                      <td className="px-4 py-3 text-[var(--flux-ink)]">{friend.blogName}</td>
                      <td className="px-4 py-3 text-[var(--flux-ink-light)] hidden sm:table-cell truncate max-w-xs">{friend.blogAddress}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteFriend.mutate({ id: friend.id })} className="p-1.5 rounded text-[var(--flux-ink-light)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pictures Grid */}
          {activeTab === 'pictures' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {picturesData?.map((pic) => (
                <div key={pic.id} className="group relative rounded-xl overflow-hidden border border-[var(--flux-line)]/50">
                  <img src={pic.pictureAddress ?? undefined} alt={pic.pictureName ?? undefined} className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--flux-marble)]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                    <span className="text-xs text-[var(--flux-ink)]">{pic.pictureName}</span>
                    <button onClick={() => deletePicture.mutate({ id: pic.id })} className="p-1 rounded bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[10000] bg-[var(--flux-marble)]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[var(--flux-ink)]">
                新建{modalType === 'blog' ? '文章' : modalType === 'type' ? '分类' : modalType === 'friend' ? '友链' : '图片'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded text-[var(--flux-ink-light)] hover:text-[var(--flux-ink)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {modalType === 'blog' && (
                <>
                  <div>
                    <label className="block text-sm text-[var(--flux-ink-light)] mb-2">标题 *</label>
                    <input type="text" required value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--flux-ink-light)] mb-2">分类 *</label>
                    <select
                      value={formData.typeId || ''}
                      onChange={e => setFormData({ ...formData, typeId: e.target.value || undefined })}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm"
                    >
                      <option value="">选择分类</option>
                      {typesData?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--flux-ink-light)] mb-2">首图 URL</label>
                    <input type="text" value={formData.firstPicture || ''} onChange={e => setFormData({ ...formData, firstPicture: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--flux-ink-light)] mb-2">摘要</label>
                    <input type="text" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--flux-ink-light)] mb-2">内容 * (Markdown)</label>
                    <textarea required rows={10} value={formData.content || ''} onChange={e => setFormData({ ...formData, content: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm resize-none font-mono" />
                  </div>
                </>
              )}

              {modalType === 'type' && (
                <div>
                  <label className="block text-sm text-[var(--flux-ink-light)] mb-2">分类名称 *</label>
                  <input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm" />
                </div>
              )}

              {modalType === 'friend' && (
                <>
                  <div>
                    <label className="block text-sm text-[var(--flux-ink-light)] mb-2">博客名称 *</label>
                    <input type="text" required value={formData.blogName || ''} onChange={e => setFormData({ ...formData, blogName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--flux-ink-light)] mb-2">博客地址 *</label>
                    <input type="url" required value={formData.blogAddress || ''} onChange={e => setFormData({ ...formData, blogAddress: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--flux-ink-light)] mb-2">图片地址 *</label>
                    <input type="url" required value={formData.pictureAddress || ''} onChange={e => setFormData({ ...formData, pictureAddress: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm" />
                  </div>
                </>
              )}

              {modalType === 'picture' && (
                <>
                  <div>
                    <label className="block text-sm text-[var(--flux-ink-light)] mb-2">图片地址 *</label>
                    <input type="url" required value={formData.pictureAddress || ''} onChange={e => setFormData({ ...formData, pictureAddress: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--flux-ink-light)] mb-2">图片名称</label>
                    <input type="text" value={formData.pictureName || ''} onChange={e => setFormData({ ...formData, pictureName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--flux-ink-light)] mb-2">图片描述</label>
                    <input type="text" value={formData.pictureDescription || ''} onChange={e => setFormData({ ...formData, pictureDescription: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink)] focus:outline-none focus:border-[var(--flux-gold)]/50 text-sm" />
                  </div>
                </>
              )}

              <button type="submit" className="w-full btn-gold flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                保存
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
