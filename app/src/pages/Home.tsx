import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useLanguage } from '@/hooks/useLanguage';
import { staticBlogs, staticFriends } from '@/lib/staticData';
import { ArrowRight, Eye, Calendar, Sparkles, Layers, Zap, Code2 } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const { t } = useLanguage();
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const featuredRef = useRef<HTMLDivElement>(null);
  const portfolioRef = useRef<HTMLDivElement>(null);
  const [hoveredProject, setHoveredProject] = useState<number | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  const recommendBlogs = staticBlogs.filter((blog) => blog.recommend).slice(0, 6);
  const friendsData = staticFriends;

  useEffect(() => {
    if (!titleRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: heroRef.current,
        start: 'top top',
        end: '+=80%',
        scrub: 1.2,
        pin: false,
      },
    });

    tl.to(titleRef.current, {
      opacity: 0,
      y: -80,
      scale: 0.9,
      ease: 'none',
    });

    return () => {
      tl.kill();
    };
  }, []);

  useEffect(() => {
    if (!featuredRef.current) return;

    const cards = featuredRef.current.querySelectorAll('.blog-card');
    cards.forEach((card, i) => {
      gsap.fromTo(card,
        { opacity: 0, y: 60 },
        {
          opacity: 1, y: 0,
          duration: 0.8,
          delay: i * 0.1,
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        }
      );
    });
  }, [recommendBlogs]);

  const projects = [
    { id: 1, name: '微服务架构平台', desc: '基于 Kubernetes 的云原生微服务治理框架', image: '/assets/grid-architecture.jpg', tags: ['Go', 'K8s', 'gRPC'] },
    { id: 2, name: '实时数据可视化引擎', desc: 'WebGL 驱动的流数据实时渲染系统', image: '/assets/grid-art-light.jpg', tags: ['WebGL', 'React', 'WebSocket'] },
    { id: 3, name: 'AI 模型训练平台', desc: '分布式深度学习训练与推理加速平台', image: '/assets/grid-neural.jpg', tags: ['Python', 'PyTorch', 'CUDA'] },
    { id: 4, name: '数字孪生城市系统', desc: '基于 UE5 的城市级数字孪生解决方案', image: '/assets/grid-hologram.jpg', tags: ['UE5', 'C++', 'IoT'] },
  ];

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  };

  return (
    <div className="relative" onMouseMove={handleMouseMove}>
      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/hero-bg.jpg"
            alt=""
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--flux-marble)]/60 via-transparent to-[var(--flux-marble)]" />
        </div>

        {/* Noise overlay */}
        <div className="absolute inset-0 z-[1] opacity-[0.03] mix-blend-overlay"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
        />

        {/* Content */}
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-xs text-[var(--flux-gold)]">
            <Sparkles className="w-3 h-3" />
            <span>金墨流境 - 数字疆域</span>
          </div>

          <h1
            ref={titleRef}
            className="text-[15vw] md:text-[12vw] font-black text-[var(--flux-ink)] uppercase tracking-tighter leading-none mb-6"
          >
            {t('hero.title')}
          </h1>

          <p className="text-lg md:text-xl text-[var(--flux-ink-light)] max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/blog" className="btn-gold inline-flex items-center gap-2">
              {t('hero.cta')}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/about"
              className="px-6 py-3 rounded-full border border-[var(--flux-line)] text-[var(--flux-ink-light)] hover:text-[var(--flux-ink)] hover:border-[var(--flux-gold)]/50 transition-all text-sm"
            >
              {t('nav.about')}
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-6 h-10 rounded-full border-2 border-[var(--flux-line)] flex items-start justify-center p-1.5">
            <div className="w-1 h-2 rounded-full bg-[var(--flux-gold)] animate-bounce" />
          </div>
        </div>
      </section>

      {/* Featured Section */}
      <section ref={featuredRef} className="relative py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-16">
          <div>
            <h2 className="section-title text-[var(--flux-ink)] mb-2">
              <span className="gold-gradient-text">域内精选</span>
            </h2>
            <p className="text-[var(--flux-ink-light)] text-sm">{t('blog.title')}</p>
          </div>
          <Link to="/blog" className="hidden sm:flex items-center gap-1 text-sm text-[var(--flux-gold)] hover:text-[var(--flux-gold-light)] transition-colors">
            查看全部 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendBlogs?.map((blog) => (
            <Link
              key={blog.id}
              to={`/blog/${blog.id}`}
              className="blog-card group card-luxury overflow-hidden block"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={blog.firstPicture || '/assets/grid-art-light.jpg'}
                  alt={blog.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--flux-marble-dark)] via-transparent to-transparent" />
                {blog.recommend && (
                  <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-[var(--flux-gold)]/20 border border-[var(--flux-gold)]/30 text-[var(--flux-gold)] text-xs">
                    推荐
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
                  {blog.flag && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--flux-gold)]/10 text-[var(--flux-gold)]">
                      {blog.flag}
                    </span>
                  )}
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
      </section>

      {/* Portfolio Matrix */}
      <section ref={portfolioRef} className="relative py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="section-title text-[var(--flux-ink)] mb-4">
          <span className="gold-gradient-text">交互视窗</span>
        </h2>
        <p className="text-[var(--flux-ink-light)] mb-16 max-w-xl">精选项目作品集，悬停查看预览</p>

        <div className="space-y-0">
          {projects.map((project, index) => (
            <div
              key={project.id}
              className="relative border-t border-[var(--flux-line)]/50 group cursor-pointer"
              onMouseEnter={() => setHoveredProject(index)}
              onMouseLeave={() => setHoveredProject(null)}
            >
              <div className="flex items-center justify-between py-6 px-4 transition-all duration-300 group-hover:pl-8">
                <div className="flex-1">
                  <h3 className={`text-xl md:text-2xl font-semibold transition-all duration-300 ${
                    hoveredProject === index ? 'text-[var(--flux-ink)]' : 'text-[var(--flux-ink-light)]'
                  }`}>
                    {project.name}
                  </h3>
                  <p className="text-sm text-[var(--flux-ink-light)] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {project.desc}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {project.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded bg-[var(--flux-marble-dark)] text-[var(--flux-ink-light)] border border-[var(--flux-line)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <ArrowRight className={`w-5 h-5 transition-all duration-300 ${
                  hoveredProject === index ? 'text-[var(--flux-gold)] translate-x-0 opacity-100' : 'opacity-0 -translate-x-2'
                }`} />
              </div>

              {/* Hover Image Preview */}
              {hoveredProject === index && (
                <div
                  className="fixed pointer-events-none z-50 w-64 h-44 rounded-lg overflow-hidden shadow-2xl"
                  style={{
                    left: mouseRef.current.x + 20,
                    top: mouseRef.current.y - 88,
                    boxShadow: '0 20px 60px rgba(212, 175, 55, 0.2)',
                  }}
                >
                  <img src={project.image} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          ))}
          <div className="border-t border-[var(--flux-line)]/50" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Code2, label: '技术文章', value: recommendBlogs?.length || 0 },
            { icon: Layers, label: '项目作品', value: projects.length },
            { icon: Zap, label: '友链数量', value: friendsData?.length || 0 },
            { icon: Eye, label: '累计访问', value: '12.8K' },
          ].map((stat, i) => (
            <div key={i} className="card-luxury p-6 text-center">
              <stat.icon className="w-6 h-6 text-[var(--flux-gold)] mx-auto mb-3" />
              <div className="text-3xl font-bold text-[var(--flux-ink)] mb-1">{stat.value}</div>
              <div className="text-xs text-[var(--flux-ink-light)]">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
