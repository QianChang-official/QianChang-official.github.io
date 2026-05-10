import { useLanguage } from '@/hooks/useLanguage';
import { Code2, Server, Database, Palette, Terminal, Cpu, Globe, Layers } from 'lucide-react';

export default function About() {
  const { t } = useLanguage();

  const skills = [
    { icon: Code2, name: 'React / Vue / TypeScript', level: 95 },
    { icon: Server, name: 'Node.js / Go / Java', level: 90 },
    { icon: Database, name: 'MySQL / PostgreSQL / Redis', level: 88 },
    { icon: Cpu, name: 'Docker / K8s / CI/CD', level: 85 },
    { icon: Palette, name: 'Three.js / WebGL / GSAP', level: 82 },
    { icon: Terminal, name: 'Linux / Nginx / Shell', level: 80 },
    { icon: Globe, name: 'GraphQL / REST / gRPC', level: 88 },
    { icon: Layers, name: 'Microservices / Event-Driven', level: 78 },
  ];

  const experiences = [
    {
      period: '2024 - 至今',
      title: '高级前端工程师',
      company: '某知名科技公司',
      desc: '负责公司核心产品的前端架构设计与性能优化，带领团队完成多个大型项目。',
    },
    {
      period: '2022 - 2024',
      title: '全栈开发工程师',
      company: '某互联网创业公司',
      desc: '独立负责多个产品的全栈开发，从需求分析到上线部署的全流程把控。',
    },
    {
      period: '2020 - 2022',
      title: '前端开发工程师',
      company: '某科技企业',
      desc: '专注于前端工程化建设，搭建了完善的组件库和开发规范体系。',
    },
  ];

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Profile */}
      <div className="flex flex-col md:flex-row items-center gap-8 mb-16">
        <div className="relative">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-2 border-[var(--flux-gold)]/30 shadow-[0_0_30px_rgba(212,175,55,0.15)]">
            <img src="/assets/avatar.jpg" alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[var(--flux-gold)] flex items-center justify-center shadow-lg">
            <Code2 className="w-4 h-4 text-[var(--flux-marble)]" />
          </div>
        </div>
        <div className="text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--flux-ink)] mb-2">
            <span className="gold-gradient-text">流境行者</span>
          </h1>
          <p className="text-[var(--flux-ink-light)] mb-4">全栈开发者 / 数字艺术家 / 技术写作者</p>
          <p className="text-sm text-[var(--flux-ink-light)] max-w-lg leading-relaxed">
            在代码与艺术的交汇处探索未知。我相信技术不仅是工具，更是表达思想与美学的媒介。
            这个博客记录了我的技术旅程、灵感火花和对数字世界的思考。
          </p>
        </div>
      </div>

      {/* Skills */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-[var(--flux-ink)] mb-8 flex items-center gap-2">
          <span className="gold-gradient-text">{t('about.skills')}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skills.map((skill) => (
            <div key={skill.name} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--flux-marble-dark)]/50 border border-[var(--flux-line)]/50">
              <skill.icon className="w-5 h-5 text-[var(--flux-gold)] flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--flux-ink)]">{skill.name}</span>
                  <span className="text-xs text-[var(--flux-gold)]">{skill.level}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--flux-line)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--flux-gold)] to-[var(--flux-gold-light)] transition-all duration-1000"
                    style={{ width: `${skill.level}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Experience */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-[var(--flux-ink)] mb-8 flex items-center gap-2">
          <span className="gold-gradient-text">工作经历</span>
        </h2>
        <div className="relative">
          <div className="absolute left-3 md:left-4 top-0 bottom-0 w-px bg-gradient-to-b from-[var(--flux-gold)] via-[var(--flux-line)] to-transparent" />
          <div className="space-y-8">
            {experiences.map((exp, i) => (
              <div key={i} className="ml-8 md:ml-10 relative">
                <div className="absolute -left-[2.15rem] md:-left-[2.4rem] top-1 w-3 h-3 rounded-full bg-[var(--flux-gold)] shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
                <div className="p-5 rounded-xl bg-[var(--flux-marble-dark)]/50 border border-[var(--flux-line)]/50 hover:border-[var(--flux-gold)]/20 transition-all">
                  <span className="text-xs text-[var(--flux-gold)] font-medium">{exp.period}</span>
                  <h3 className="text-base font-semibold text-[var(--flux-ink)] mt-1">{exp.title}</h3>
                  <p className="text-sm text-[var(--flux-ink-light)] mb-2">{exp.company}</p>
                  <p className="text-sm text-[var(--flux-ink-light)] leading-relaxed">{exp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '技术文章', value: '50+' },
          { label: '开源项目', value: '12' },
          { label: '技术栈', value: '20+' },
          { label: '编码年限', value: '6年+' },
        ].map((stat) => (
          <div key={stat.label} className="card-luxury p-6 text-center">
            <div className="text-2xl md:text-3xl font-bold gold-gradient-text mb-1">{stat.value}</div>
            <div className="text-xs text-[var(--flux-ink-light)]">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
