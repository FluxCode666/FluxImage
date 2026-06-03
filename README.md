# FluxImage

**FluxImage** 是一个轻量级、功能强大的 AI 绘图 Web 应用，一个有趣的实验性项目——其核心代码完全由 AI 编写生成。

项目支持文生图、图生图及图片二次编辑功能，并配备了完整的用户系统和超级管理员后台，非常适合新手学习和快速部署。


---

## ✨ 主要功能

-   🎨 **AI 绘图**:
    -   支持 **文本生成图片** (Text-to-Image) 和 **图片生成图片** (Image-to-Image)。
    -   支持多种 AI 模型，可输出高清图片。
    -   用户系统支持 **每日签到** 获取积分。
    -   用户可 **自定义配置 API Key**。
-   ✏️ **图片二次编辑**: 生成后的图片支持在线进行微调和修饰。
-   🔐 **完整的用户系统**:
    -   包含用户注册、登录（支持邮箱验证码）。
-   🛡️ **强大的后台管理**:
    -   内置超级管理员系统，可管理用户、灵感图、公告等。
-   🚀 **现代化技术栈**:
    -   Next.js + React + TypeScript + Tailwind CSS + shadcn/ui

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **框架** | Next.js 14 (App Router) |
| **前端** | React 18 + TypeScript |
| **UI 组件** | shadcn/ui (Radix UI + Tailwind CSS) |
| **样式** | Tailwind CSS |
| **ORM** | Prisma |
| **数据库** | PostgreSQL  |
| **缓存/会话** | Redis (ioredis) |
| **认证** | JWT (jsonwebtoken) |
| **AI 服务** | 外部 API (axios) |

