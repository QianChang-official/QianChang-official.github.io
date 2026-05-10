export const staticTypes = [
  { id: 1, name: "技术架构" },
  { id: 2, name: "前端开发" },
  { id: 3, name: "后端设计" },
  { id: 4, name: "人工智能" },
  { id: 5, name: "生活随笔" },
  { id: 6, name: "摄影艺术" },
];

export const staticBlogs = [
  {
    id: 1,
    title: "构建高可用的微服务架构实践",
    content:
      "# 构建高可用的微服务架构实践\n\n微服务架构已经成为现代软件开发的主流范式。本文将深入探讨如何构建一个高可用、可扩展的微服务系统。\n\n## 服务拆分原则\n\n- 按业务领域拆分\n- 单一职责原则\n- 数据独立性\n\n## 技术选型\n\n我们选择了以下技术栈：\n- Spring Cloud: 服务治理框架\n- Kubernetes: 容器编排平台\n- MySQL + Redis: 数据存储方案\n\n## 实践经验\n\n在实际项目中，清晰的服务边界、可观测性、渐进式发布和故障隔离，是支撑系统长期演进的关键。",
    description: "深入探讨微服务架构的设计原则与实践经验，包括服务拆分、技术选型和治理策略。",
    firstPicture: "/assets/grid-architecture.jpg",
    flag: "原创",
    views: 1280,
    recommend: true,
    published: true,
    typeId: 1,
    createdAt: "2026-03-18T09:00:00.000Z",
    updatedAt: "2026-03-18T09:00:00.000Z",
  },
  {
    id: 2,
    title: "Three.js 着色器编程艺术",
    content:
      "# Three.js 着色器编程艺术\n\nWebGL 和 Three.js 为前端开发者打开了通往 3D 图形世界的大门。\n\n## GLSL 基础\n\n着色器语言 GLSL 是一种类 C 语言，用于在 GPU 上执行图形计算。\n\n## 实战案例：极光效果\n\n通过噪声、渐变、透明混合和多层色彩叠加，可以创造出具有空间深度的极光效果。关键是把视觉参数拆成可控变量，让动画既稳定又富有变化。",
    description: "探索 Three.js 中 GLSL 着色器的强大能力，从基础语法到高级特效实现的完整指南。",
    firstPicture: "/assets/grid-art-light.jpg",
    flag: "原创",
    views: 892,
    recommend: true,
    published: true,
    typeId: 2,
    createdAt: "2026-02-24T09:00:00.000Z",
    updatedAt: "2026-02-24T09:00:00.000Z",
  },
  {
    id: 3,
    title: "数字孪生：未来城市的神经网络",
    content:
      "# 数字孪生：未来城市的神经网络\n\n数字孪生技术正在重新定义我们对城市管理的理解。\n\n## 技术架构\n\n数字孪生城市通常包含感知层、传输层、平台层和应用层。传感器网络负责采集现实世界状态，平台层负责建模、推演和决策支持。\n\n## 实际应用\n\n交通管理、应急响应、能源调度和基础设施巡检，都是数字孪生能够直接创造价值的方向。",
    description: "解析数字孪生技术在城市管理中的应用，探讨从概念到落地实施的完整路径。",
    firstPicture: "/assets/grid-hologram.jpg",
    flag: "原创",
    views: 756,
    recommend: true,
    published: true,
    typeId: 4,
    createdAt: "2026-01-16T09:00:00.000Z",
    updatedAt: "2026-01-16T09:00:00.000Z",
  },
  {
    id: 4,
    title: "深度学习模型优化实战指南",
    content:
      "# 深度学习模型优化实战指南\n\n模型训练只是第一步，如何让模型在生产环境中高效运行才是关键。\n\n## 推理优化技术\n\n模型量化、知识蒸馏、算子融合和批处理调度可以分别从精度、模型规模、执行效率和吞吐量维度提升系统表现。\n\n## 性能对比\n\n优化策略需要围绕真实业务指标评估，不能只看离线 benchmark。",
    description: "系统性地介绍深度学习模型在生产环境的优化策略，涵盖量化、蒸馏和算子融合等技术。",
    firstPicture: "/assets/grid-neural.jpg",
    flag: "原创",
    views: 643,
    recommend: false,
    published: true,
    typeId: 4,
    createdAt: "2025-12-09T09:00:00.000Z",
    updatedAt: "2025-12-09T09:00:00.000Z",
  },
  {
    id: 5,
    title: "ancient ring: 考古学与未来科技的交汇",
    content:
      "# 考古学与未来科技的交汇\n\n当激光雷达扫描遗迹时，我们能看到肉眼无法发现的结构线索。\n\n## 科技考古\n\nLiDAR、CT 扫描、DNA 分析和虚拟重建正在改变考古研究的方法。技术让研究者能够在尽量不破坏现场和文物的前提下，获得更多可验证的信息。",
    description: "探讨现代科技如何革新考古学研究，以及这些发现如何启发未来技术发展。",
    firstPicture: "/assets/grid-ring.jpg",
    flag: "原创",
    views: 521,
    recommend: false,
    published: true,
    typeId: 5,
    createdAt: "2025-11-20T09:00:00.000Z",
    updatedAt: "2025-11-20T09:00:00.000Z",
  },
  {
    id: 6,
    title: "城市夜景摄影技巧分享",
    content:
      "# 城市夜景摄影技巧分享\n\n城市夜景是最具挑战性的摄影题材之一。\n\n## 器材准备\n\n稳定的三脚架、广角镜头、快门线或遥控器能显著提高成片率。\n\n## 相机设置\n\n建议从低 ISO、小光圈和长曝光开始，再根据高光控制与运动轨迹调整参数。",
    description: "分享城市夜景摄影的完整技巧，从器材选择到后期处理的全流程指南。",
    firstPicture: "/assets/grid-cityscape.jpg",
    flag: "原创",
    views: 445,
    recommend: false,
    published: true,
    typeId: 6,
    createdAt: "2025-10-12T09:00:00.000Z",
    updatedAt: "2025-10-12T09:00:00.000Z",
  },
];

export const staticFriends = [
  {
    id: 1,
    blogName: "掘金技术社区",
    blogAddress: "https://juejin.cn",
    pictureAddress: "/assets/grid-neural.jpg",
    createdAt: "2026-01-01T09:00:00.000Z",
  },
  {
    id: 2,
    blogName: "知乎",
    blogAddress: "https://www.zhihu.com",
    pictureAddress: "/assets/grid-hologram.jpg",
    createdAt: "2026-01-02T09:00:00.000Z",
  },
  {
    id: 3,
    blogName: "GitHub",
    blogAddress: "https://github.com",
    pictureAddress: "/assets/grid-architecture.jpg",
    createdAt: "2026-01-03T09:00:00.000Z",
  },
  {
    id: 4,
    blogName: "V2EX",
    blogAddress: "https://www.v2ex.com",
    pictureAddress: "/assets/grid-ring.jpg",
    createdAt: "2026-01-04T09:00:00.000Z",
  },
];

export const staticPictures = [
  { id: 1, pictureAddress: "/assets/grid-architecture.jpg", pictureName: "数字神庙", pictureDescription: "未来主义建筑与金色光芒的交汇", pictureTime: "2026年3月" },
  { id: 2, pictureAddress: "/assets/grid-art-light.jpg", pictureName: "流光之舞", pictureDescription: "液态金属的微观抽象", pictureTime: "2026年2月" },
  { id: 3, pictureAddress: "/assets/grid-hologram.jpg", pictureName: "数字之城", pictureDescription: "全息投影中的未来都市", pictureTime: "2026年1月" },
  { id: 4, pictureAddress: "/assets/grid-neural.jpg", pictureName: "神经网络", pictureDescription: "AI之树的数字艺术", pictureTime: "2025年12月" },
  { id: 5, pictureAddress: "/assets/grid-ring.jpg", pictureName: "星际之门", pictureDescription: "古老符号与未来科技的融合", pictureTime: "2025年11月" },
  { id: 6, pictureAddress: "/assets/grid-cityscape.jpg", pictureName: "金色都市", pictureDescription: "夜幕下的未来城市", pictureTime: "2025年10月" },
  { id: 7, pictureAddress: "/assets/hero-bg.jpg", pictureName: "数据深渊", pictureDescription: "探索者凝视数据的深渊", pictureTime: "2025年9月" },
];

export const staticMessages = [
  {
    id: 1,
    nickname: "站点访客",
    email: "visitor@example.com",
    content: "欢迎来到新的音源入口音乐盒站点。",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=visitor",
    createdAt: "2026-03-01T09:00:00.000Z",
    adminMessage: false,
  },
];

export const staticComments = [
  {
    id: 1,
    blogId: 1,
    nickname: "Flux",
    email: "flux@example.com",
    content: "这篇文章已迁移为静态展示内容。",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=flux",
    createdAt: "2026-03-20T09:00:00.000Z",
  },
];

export function getBlogWithRelations(id: number) {
  const blog = staticBlogs.find((item) => item.id === id);
  if (!blog) return null;

  return {
    ...blog,
    type: staticTypes.find((type) => type.id === blog.typeId) ?? null,
    comments: staticComments.filter((comment) => comment.blogId === id),
  };
}
