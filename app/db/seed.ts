import { getDb } from "../api/queries/connection";
import { types, blogs, friends, pictures } from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Seed types
  const typeData = [
    { name: "技术架构" },
    { name: "前端开发" },
    { name: "后端设计" },
    { name: "人工智能" },
    { name: "生活随笔" },
    { name: "摄影艺术" },
  ];
  await db.insert(types).values(typeData);
  console.log("Types seeded.");

  // Seed blogs
  const blogData = [
    {
      title: "构建高可用的微服务架构实践",
      content: "# 构建高可用的微服务架构实践\n\n微服务架构已经成为现代软件开发的主流范式。本文将深入探讨如何构建一个高可用、可扩展的微服务系统。\n\n## 服务拆分原则\n\n- 按业务领域拆分\n- 单一职责原则\n- 数据独立性\n\n## 技术选型\n\n我们选择了以下技术栈：\n- **Spring Cloud**: 服务治理框架\n- **Kubernetes**: 容器编排平台\n- **MySQL + Redis**: 数据存储方案\n\n## 实践经验\n\n在实际项目中，我们发现以下关键点至关重要...",
      description: "深入探讨微服务架构的设计原则与实践经验，包括服务拆分、技术选型和治理策略。",
      firstPicture: "/assets/grid-architecture.jpg",
      flag: "原创",
      views: 1280,
      recommend: true,
      published: true,
      typeId: 1,
    },
    {
      title: "Three.js 着色器编程艺术",
      content: "# Three.js 着色器编程艺术\n\nWebGL 和 Three.js 为前端开发者打开了通往 3D 图形世界的大门。\n\n## GLSL 基础\n\n着色器语言 GLSL 是一种类 C 语言，用于在 GPU 上执行图形计算。\n\n## 片段着色器示例\n\n```glsl\nvoid main() {\n  vec2 uv = gl_FragCoord.xy / u_resolution;\n  vec3 color = vec3(uv, 0.5);\n  gl_FragColor = vec4(color, 1.0);\n}\n```\n\n## 实战案例：极光效果\n\n我们将通过 simplex noise 和多层色彩叠加，创造出逼真的极光效果...",
      description: "探索 Three.js 中 GLSL 着色器的强大能力，从基础语法到高级特效实现的完整指南。",
      firstPicture: "/assets/grid-art-light.jpg",
      flag: "原创",
      views: 892,
      recommend: true,
      published: true,
      typeId: 2,
    },
    {
      title: "数字孪生：未来城市的神经网络",
      content: "# 数字孪生：未来城市的神经网络\n\n数字孪生技术正在重新定义我们对城市管理的理解。\n\n## 什么是数字孪生\n\n数字孪生是指通过数字化手段，在虚拟空间中创建物理实体的精确映射。\n\n## 技术架构\n\n数字孪生城市通常包含以下层次：\n1. 感知层：IoT 传感器网络\n2. 传输层：5G / 边缘计算\n3. 平台层：数据中台\n4. 应用层：可视化与决策支持\n\n## 实际应用\n\n在新加坡和杭州，数字孪生技术已经成功应用于交通管理和应急响应...",
      description: "解析数字孪生技术在城市管理中的应用，探讨从概念到落地实施的完整路径。",
      firstPicture: "/assets/grid-hologram.jpg",
      flag: "原创",
      views: 756,
      recommend: true,
      published: true,
      typeId: 4,
    },
    {
      title: "深度学习模型优化实战指南",
      content: "# 深度学习模型优化实战指南\n\n模型训练只是第一步，如何让模型在生产环境中高效运行才是关键。\n\n## 推理优化技术\n\n### 1. 模型量化\n将 FP32 权重压缩到 INT8 或更低精度...\n\n### 2. 知识蒸馏\n用大模型指导小模型学习...\n\n### 3. 算子融合\n合并相邻算子减少内存访问...\n\n## 性能对比\n\n| 优化方法 | 精度损失 | 速度提升 |\n|---------|---------|---------|\n| INT8量化 | <1% | 2-4x |\n| 蒸馏 | <3% | 3-5x |\n| 算子融合 | 0% | 1.2-1.5x |",
      description: "系统性地介绍深度学习模型在生产环境的优化策略，涵盖量化、蒸馏和算子融合等技术。",
      firstPicture: "/assets/grid-neural.jpg",
      flag: "原创",
      views: 643,
      recommend: false,
      published: true,
      typeId: 4,
    },
    {
      title: " ancient ring: 考古学与未来科技的交汇",
      content: "# 考古学与未来科技的交汇\n\n当激光雷达扫描 Mayan 金字塔时，我们发现了前所未有的地下通道网络。\n\n## 科技考古\n\n现代科技正在彻底改变考古学的研究方法：\n- **LiDAR**: 穿透植被发现遗迹\n- **CT扫描**: 不破坏文物进行内部观察\n- **DNA分析**: 追溯人类迁徙路径\n\n## 未来展望\n\n虚拟现实技术让我们能够'穿越'回古代城市，亲身体验历史...",
      description: "探讨现代科技如何革新考古学研究，以及这些发现如何启发未来技术发展。",
      firstPicture: "/assets/grid-ring.jpg",
      flag: "原创",
      views: 521,
      recommend: false,
      published: true,
      typeId: 5,
    },
    {
      title: "城市夜景摄影技巧分享",
      content: "# 城市夜景摄影技巧分享\n\n城市夜景是最具挑战性的摄影题材之一。\n\n## 器材准备\n\n- 三脚架（必备）\n- 广角镜头 16-35mm\n- 快门线或遥控器\n\n## 相机设置\n\n- 光圈：f/8 - f/11\n- ISO：100-400\n- 快门：10-30秒\n- 白平衡：钨丝灯或手动 K 值\n\n## 构图技巧\n\n寻找引导线、对称性和前景元素...",
      description: "分享城市夜景摄影的完整技巧，从器材选择到后期处理的全流程指南。",
      firstPicture: "/assets/grid-cityscape.jpg",
      flag: "原创",
      views: 445,
      recommend: false,
      published: true,
      typeId: 6,
    },
  ];
  await db.insert(blogs).values(blogData);
  console.log("Blogs seeded.");

  // Seed friends
  const friendData = [
    {
      blogName: "掘金技术社区",
      blogAddress: "https://juejin.cn",
      pictureAddress: "/assets/grid-neural.jpg",
    },
    {
      blogName: "知乎",
      blogAddress: "https://www.zhihu.com",
      pictureAddress: "/assets/grid-hologram.jpg",
    },
    {
      blogName: "GitHub",
      blogAddress: "https://github.com",
      pictureAddress: "/assets/grid-architecture.jpg",
    },
    {
      blogName: "V2EX",
      blogAddress: "https://www.v2ex.com",
      pictureAddress: "/assets/grid-ring.jpg",
    },
  ];
  await db.insert(friends).values(friendData);
  console.log("Friends seeded.");

  // Seed pictures
  const pictureData = [
    {
      pictureAddress: "/assets/grid-architecture.jpg",
      pictureName: "数字神庙",
      pictureDescription: "未来主义建筑与金色光芒的交汇",
      pictureTime: "2026年3月",
    },
    {
      pictureAddress: "/assets/grid-art-light.jpg",
      pictureName: "流光之舞",
      pictureDescription: "液态金属的微观抽象",
      pictureTime: "2026年2月",
    },
    {
      pictureAddress: "/assets/grid-hologram.jpg",
      pictureName: "数字之城",
      pictureDescription: "全息投影中的未来都市",
      pictureTime: "2026年1月",
    },
    {
      pictureAddress: "/assets/grid-neural.jpg",
      pictureName: "神经网络",
      pictureDescription: "AI之树的数字艺术",
      pictureTime: "2025年12月",
    },
    {
      pictureAddress: "/assets/grid-ring.jpg",
      pictureName: "星际之门",
      pictureDescription: "古老符号与未来科技的融合",
      pictureTime: "2025年11月",
    },
    {
      pictureAddress: "/assets/grid-cityscape.jpg",
      pictureName: "金色都市",
      pictureDescription: "夜幕下的未来城市",
      pictureTime: "2025年10月",
    },
    {
      pictureAddress: "/assets/hero-bg.jpg",
      pictureName: "数据深渊",
      pictureDescription: "探索者凝视数据的深渊",
      pictureTime: "2025年9月",
    },
  ];
  await db.insert(pictures).values(pictureData);
  console.log("Pictures seeded.");

  console.log("All seed data inserted successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
