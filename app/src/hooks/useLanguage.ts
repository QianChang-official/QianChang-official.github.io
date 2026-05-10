import { useState, useCallback, useEffect } from 'react';

export type Language = 'zh' | 'en';

const STORAGE_KEY = 'site-language';

const translations: Record<string, Record<Language, string>> = {
  // Navigation
  'nav.blog': { zh: '文章', en: 'Blog' },
  'nav.timeline': { zh: '时间轴', en: 'Timeline' },
  'nav.gallery': { zh: '相册', en: 'Gallery' },
  'nav.messages': { zh: '留言', en: 'Messages' },
  'nav.friends': { zh: '友链', en: 'Friends' },
  'nav.about': { zh: '关于', en: 'About' },
  'nav.dashboard': { zh: '仪表盘', en: 'Dashboard' },
  'nav.home': { zh: '首页', en: 'Home' },

  // Hero
  'hero.title': { zh: '流境', en: 'FLUX' },
  'hero.subtitle': { zh: '在数据深渊中探索未知的边界', en: 'Exploring the Unknown in the Data Abyss' },
  'hero.cta': { zh: '开始探索', en: 'Start Exploring' },

  // Blog
  'blog.title': { zh: '文章', en: 'Articles' },
  'blog.search': { zh: '搜索文章...', en: 'Search articles...' },
  'blog.allCategories': { zh: '全部分类', en: 'All Categories' },
  'blog.readMore': { zh: '阅读更多', en: 'Read More' },
  'blog.views': { zh: '次浏览', en: ' views' },
  'blog.comments': { zh: '条评论', en: ' comments' },
  'blog.noResults': { zh: '没有找到相关文章', en: 'No articles found' },
  'blog.original': { zh: '原创', en: 'Original' },
  'blog.repost': { zh: '转载', en: 'Repost' },
  'blog.translate': { zh: '翻译', en: 'Translate' },

  // Gallery
  'gallery.title': { zh: '影像空间', en: 'Gallery' },
  'gallery.description': { zh: '光影交错的数字视界', en: 'A Digital World of Light and Shadow' },

  // Messages
  'messages.title': { zh: '留言板', en: 'Message Board' },
  'messages.subtitle': { zh: '留下你的足迹，与我交流思想', en: 'Leave your mark, exchange ideas with me' },
  'messages.name': { zh: '昵称', en: 'Name' },
  'messages.email': { zh: '邮箱', en: 'Email' },
  'messages.content': { zh: '留言内容', en: 'Message' },
  'messages.submit': { zh: '提交留言', en: 'Submit' },
  'messages.placeholder': { zh: '写下你想说的话...', en: 'Write what you want to say...' },
  'messages.reply': { zh: '回复', en: 'Reply' },

  // Friends
  'friends.title': { zh: '友情链接', en: 'Friendly Links' },
  'friends.subtitle': { zh: '与志同道合者同行的旅程', en: 'Journey with Like-minded Souls' },

  // About
  'about.title': { zh: '关于我', en: 'About Me' },
  'about.skills': { zh: '技术栈', en: 'Tech Stack' },

  // Footer
  'footer.copyright': { zh: '金墨流境. 保留所有权利.', en: 'Gold Ink Flux. All rights reserved.' },

  // Common
  'common.loading': { zh: '加载中...', en: 'Loading...' },
  'common.loadMore': { zh: '加载更多', en: 'Load More' },
  'common.submit': { zh: '提交', en: 'Submit' },
  'common.cancel': { zh: '取消', en: 'Cancel' },
  'common.delete': { zh: '删除', en: 'Delete' },
  'common.edit': { zh: '编辑', en: 'Edit' },
  'common.create': { zh: '新建', en: 'Create' },
  'common.save': { zh: '保存', en: 'Save' },
  'common.close': { zh: '关闭', en: 'Close' },
  'common.back': { zh: '返回', en: 'Back' },

  // Admin
  'admin.title': { zh: '域管理后台', en: 'Dashboard' },
  'admin.blogs': { zh: '文章管理', en: 'Blog Management' },
  'admin.types': { zh: '分类管理', en: 'Category Management' },
  'admin.comments': { zh: '评论管理', en: 'Comments' },
  'admin.messages': { zh: '留言管理', en: 'Messages' },
  'admin.friends': { zh: '友链管理', en: 'Friend Links' },
  'admin.pictures': { zh: '相册管理', en: 'Gallery' },
  'admin.totalBlogs': { zh: '总文章数', en: 'Total Articles' },
  'admin.totalComments': { zh: '总评论数', en: 'Total Comments' },
  'admin.totalMessages': { zh: '总留言数', en: 'Total Messages' },
  'admin.totalFriends': { zh: '总友链数', en: 'Total Friends' },
};

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEY) as Language) || 'zh';
    }
    return 'zh';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    window.dispatchEvent(new CustomEvent('language-change', { detail: language }));
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback((key: string): string => {
    return translations[key]?.[language] || key;
  }, [language]);

  return { language, setLanguage, t };
}
