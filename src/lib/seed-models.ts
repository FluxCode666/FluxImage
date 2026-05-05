import { Client } from 'pg'
import { getDatabaseUrl } from './database'

const DEFAULT_MODELS = [
  { model_id: 'nano-banana', display_name: 'Nano Banana', icon: '🍌', description: '标准模式，生成速度快', sort_order: 0 },
  { model_id: 'nano-banana-hd', display_name: 'Nano Banana HD', icon: '✨', description: '高清模式，增强画质', sort_order: 1 },
  { model_id: 'nano-banana-2', display_name: 'Nano Banana 2.0', icon: '🚀', description: '最新大模型，极致画质', sort_order: 2 },
  { model_id: 'nano-banana-2-2k', display_name: 'Nano Banana 2K', icon: '🔷', description: '2K 超清分辨率', sort_order: 3 },
  { model_id: 'nano-banana-2-4k', display_name: 'Nano Banana 4K', icon: '💠', description: '4K 极致细节', sort_order: 4 },
  { model_id: 'gpt-4o-image', display_name: 'GPT-4o Image', icon: '🌟', description: 'OpenAI 图像生成', sort_order: 5 },
  { model_id: 'gpt-image-2', display_name: 'GPT Image 2', icon: '🎨', description: 'OpenAI 最新图像模型', sort_order: 6 },
]

/**
 * 初始化模型配置和系统配置
 * - 若 model_config 表为空，插入默认模型列表
 * - 若 system_config 表为空，从 .env 读取默认 API 配置写入
 */
export async function seedModels() {
  const databaseUrl = getDatabaseUrl()
  if (!databaseUrl) {
    console.log('⏭️  [SeedModels] 数据库未配置，跳过')
    return
  }

  const client = new Client({ connectionString: databaseUrl })

  try {
    await client.connect()

    // ── 初始化模型配置 ──
    const modelCount = await client.query('SELECT COUNT(*) as cnt FROM model_config')
    if (parseInt(modelCount.rows[0].cnt) === 0) {
      for (const m of DEFAULT_MODELS) {
        await client.query(
          `INSERT INTO model_config (model_id, display_name, icon, description, sort_order)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (model_id) DO NOTHING`,
          [m.model_id, m.display_name, m.icon, m.description, m.sort_order]
        )
      }
      console.log(`✅ [SeedModels] 已初始化 ${DEFAULT_MODELS.length} 个默认模型`)
    } else {
      console.log('✅ [SeedModels] 模型配置已存在，跳过')
    }

    // ── 初始化系统配置 ──
    const configCount = await client.query('SELECT COUNT(*) as cnt FROM system_config')
    const defaults: Record<string, string> = {
      site_name: process.env.SITE_NAME || 'FluxImage',
      site_subtitle: process.env.SITE_SUBTITLE || 'AI Creative Studio',
      default_api_base_url: 'https://api.openai.com',
      default_api_key: '',
      allow_custom_api: 'true',
    }

    if (parseInt(configCount.rows[0].cnt) === 0) {
      for (const [key, value] of Object.entries(defaults)) {
        await client.query(
          `INSERT INTO system_config (config_key, config_value)
           VALUES ($1, $2)
           ON CONFLICT (config_key) DO NOTHING`,
          [key, value]
        )
      }
      console.log('✅ [SeedModels] 已初始化系统默认配置')
    } else {
      await client.query(
        `INSERT INTO system_config (config_key, config_value)
         VALUES ($1, $2), ($3, $4)
         ON CONFLICT (config_key) DO NOTHING`,
        ['site_name', defaults.site_name, 'site_subtitle', defaults.site_subtitle]
      )
      console.log('✅ [SeedModels] 系统配置已存在，已补齐站点默认配置')
    }
  } catch (error) {
    console.error('❌ [SeedModels] 初始化失败:', error)
  } finally {
    await client.end()
  }
}
