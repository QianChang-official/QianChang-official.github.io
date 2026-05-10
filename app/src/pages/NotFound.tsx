import { Link } from "react-router";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 z-0">
        <img src="/assets/grid-ring.jpg" alt="" className="w-full h-full object-cover opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--flux-marble)] via-[var(--flux-marble)]/80 to-[var(--flux-marble)]" />
      </div>
      <div className="text-center relative z-10">
        <Compass className="w-16 h-16 text-[var(--flux-gold)]/40 mx-auto mb-6" />
        <h1 className="text-8xl font-black gold-gradient-text mb-4">404</h1>
        <p className="text-xl text-[var(--flux-ink)] mb-2">迷失在数据深渊中</p>
        <p className="text-sm text-[var(--flux-ink-light)] mb-8 max-w-md mx-auto">
          您访问的页面不存在，或已被转移到了其他维度。
        </p>
        <Link to="/" className="btn-gold inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>
      </div>
    </div>
  );
}
