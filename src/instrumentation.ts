export async function register() {
  // 仅在 Node.js 服务端运行时执行（不在 Edge Runtime）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runMigrations } = await import('@/lib/migrator')
    try {
      await runMigrations()
    } catch (error) {
      console.error('❌ 启动迁移失败，应用仍将继续运行:', error)
    }
  }
}
