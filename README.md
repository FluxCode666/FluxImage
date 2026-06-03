# FluxImage

![GitHub stars](https://img.shields.io/github/stars/pili1121/Nano-Banana?style=flat-square)![GitHub forks](https://img.shields.io/github/forks/pili1121/Nano-Banana?style=flat-square)![GitHub issues](https://img.shields.io/github/issues/pili1121/Nano-Banana?style=flat-square)

**FluxImage** 是一个轻量级、功能强大的 AI 绘图 Web 应用，一个有趣的实验性项目——其核心代码完全由 AI 编写生成。

项目支持文生图、图生图及图片二次编辑功能，并配备了完整的用户系统和超级管理员后台，非常适合新手学习和快速部署。

> 👋 **作者心声**: 我也是个编程新手，这个项目是我引导 AI 完成的。欢迎大家一起交流、学习和改进它！

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
| **数据库** | PostgreSQL (主) / SQLite (备选) |
| **缓存/会话** | Redis (ioredis) |
| **认证** | JWT (jsonwebtoken) |
| **AI 服务** | 外部 API (axios) |
| **邮件** | Nodemailer (SMTP) |
| **图片处理** | Sharp |

---

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/pili1121/Nano-Banana.git
cd Nano-Banana
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 并修改为你自己的配置：

```bash
cp .env.example .env
```

需要配置的关键项：
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `DB_TIMEZONE` - PostgreSQL 数据库配置
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` - Redis 配置
- `JWT_SECRET` - JWT 密钥
- `MAIL_*` - SMTP 邮件配置
- AI API 和 OSS 存储配置请在管理后台「系统配置」中设置

### 4. 初始化数据库

```bash
# PostgreSQL
npx prisma generate
npx prisma db push

# 若使用 SQLite 备选方案
npx prisma generate --schema=prisma/schema.sqlite.prisma
npx prisma db push --schema=prisma/schema.sqlite.prisma
```

### 5. 启动开发服务

```bash
npm run dev
```

访问 http://localhost:3000

### 6. 生产部署

```bash
npm run build
npm start
```

---

## 📁 项目结构

```bash
src/
├── app/
│   ├── api/           # API 路由
│   │   ├── auth/      # 登录、注册、验证码
│   │   ├── user/      # 用户信息、签到、API Key
│   │   ├── image/     # 图片生成、编辑、历史
│   │   └── admin/     # 管理后台接口
│   ├── login/         # 登录页
│   ├── admin/         # 管理页
│   ├── tutorial/      # 教程页
│   ├── layout.tsx     # 根布局
│   ├── page.tsx       # 主页（AI 绘图）
│   └── globals.css    # 全局样式
├── components/ui/     # shadcn/ui 组件
├── lib/               # 核心库
│   ├── db.ts          # Prisma 数据库
│   ├── redis.ts       # Redis 缓存
│   ├── auth.ts        # JWT 认证
│   ├── ai-service.ts  # AI API 服务
│   ├── mail-service.ts# 邮件服务
│   └── utils.ts       # 工具函数
prisma/
├── schema.prisma          # PostgreSQL schema
└── schema.sqlite.prisma   # SQLite 备选 schema
```

---

## 📈 更新日志

-   **v2.0** - 重构为 Next.js + React + PostgreSQL + Redis 架构
-   **v1.x** - Express + MySQL + 原生前端

---
