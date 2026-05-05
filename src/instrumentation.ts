export async function register() {
  // 仅在 Node.js 服务端运行时执行（不在 Edge Runtime）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runMigrations } = await import('@/lib/migrator')
    const { seedAdmin } = await import('@/lib/seed-admin')
    const { seedModels } = await import('@/lib/seed-models')
    try {
      await runMigrations()
    } catch (error) {
      console.error('❌ 启动迁移失败，应用仍将继续运行:', error)
    }
    try {
      await seedAdmin()
    } catch (error) {
      console.error('❌ 管理员初始化失败，应用仍将继续运行:', error)
    }
    try {
      await seedModels()
    } catch (error) {
      console.error('❌ 模型配置初始化失败，应用仍将继续运行:', error)
    }
    try {
      const { requeuePendingUploads, startRetryConsumer } = await import('@/lib/local-fallback')
      await requeuePendingUploads()
      await startRetryConsumer()
    } catch (error) {
      console.error('❌ 上传重试消费者启动失败:', error)
    }
  }
}
