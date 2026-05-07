const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// 中间件：验证用户Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: '需要提供访问令牌' });
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: '无效或过期的访问令牌' });
        req.user = user;
        next();
    });
};

/**
 * 获取用户信息
 * GET /api/user/info
 */
router.get('/info', authenticateToken, async (req, res, next) => {
    let connection;
    try {
        const userId = req.user.id;
        
        connection = await pool.getConnection();

        const [users] = await connection.execute(
            `SELECT 
                id,
                username,
                email,
                drawing_points,
                creation_count,
                last_checkin_date,
                checkin_count,
                created_at
            FROM users 
            WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }

        const user = users[0];
        
        // 【修复】检查是否可以签到
        let canCheckin = true;
        if (user.last_checkin_date) {
            const lastCheckinDate = new Date(user.last_checkin_date);
            const today = new Date();
            
            // 比较年月日，不比较时间
            const lastDate = new Date(lastCheckinDate.getFullYear(), lastCheckinDate.getMonth(), lastCheckinDate.getDate());
            const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            
            // 如果最后签到日期等于今天，就不能签到
            canCheckin = lastDate.getTime() !== todayDate.getTime();
        }

        console.log(`用户 ${userId} 信息:`, {
            drawing_points: user.drawing_points,
            checkin_count: user.checkin_count,
            last_checkin_date: user.last_checkin_date,
            can_checkin: canCheckin
        });

        res.json({
            success: true,
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                drawing_points: user.drawing_points || 0,
                creation_count: user.creation_count || 0,
                checkin_count: user.checkin_count || 0,
                last_checkin_date: user.last_checkin_date,
                can_checkin: canCheckin,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error('获取用户信息错误:', error);
        res.status(500).json({
            success: false,
            error: '获取用户信息失败: ' + error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * 签到功能
 * POST /api/user/checkin
 */
router.post('/checkin', authenticateToken, async (req, res, next) => {
    let connection;
    try {
        const userId = req.user.id;
        
        connection = await pool.getConnection();

        // 1️⃣ 获取用户当前信息
        const [users] = await connection.execute(
            `SELECT drawing_points, last_checkin_date, checkin_count FROM users WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }

        const user = users[0];
        
        // 2️⃣ 检查是否已经签到过
        let canCheckin = true;
        if (user.last_checkin_date) {
            const lastCheckinDate = new Date(user.last_checkin_date);
            const today = new Date();
            
            const lastDate = new Date(lastCheckinDate.getFullYear(), lastCheckinDate.getMonth(), lastCheckinDate.getDate());
            const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            
            canCheckin = lastDate.getTime() !== todayDate.getTime();
        }

        if (!canCheckin) {
            console.log(`用户 ${userId} 今天已经签到过了`);
            return res.status(400).json({
                success: false,
                error: '今天已经签到过了，请明天再来！',
                last_checkin_date: user.last_checkin_date
            });
        }

        // 3️⃣ 开始事务处理
        await connection.beginTransaction();

        try {
            // 更新用户积分和签到信息
            const newPoints = (user.drawing_points || 0) + 10;
            const newCheckinCount = (user.checkin_count || 0) + 1;
            
            // 【修复】使用今天的日期，格式为 YYYY-MM-DD
            const today = new Date();
            const todayString = today.getFullYear() + '-' + 
                              String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                              String(today.getDate()).padStart(2, '0');

            console.log(`更新用户 ${userId}:`, {
                newPoints,
                newCheckinCount,
                todayString
            });

            await connection.execute(
                `UPDATE users 
                 SET drawing_points = ?,
                     checkin_count = ?,
                     last_checkin_date = ?
                 WHERE id = ?`,
                [newPoints, newCheckinCount, todayString, userId]
            );

            // 提交事务
            await connection.commit();

            console.log(`✅ 用户 ${userId} 签到成功，获得10积分，总签到次数: ${newCheckinCount}`);

            res.json({
                success: true,
                message: '签到成功！获得10积分',
                data: {
                    points_earned: 10,
                    total_points: newPoints,
                    checkin_count: newCheckinCount,
                    last_checkin_date: todayString
                }
            });

        } catch (error) {
            // 回滚事务
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('签到错误:', error);
        res.status(500).json({
            success: false,
            error: '签到失败: ' + error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
// ✅ 【新增】API Key 管理功能
// ==========================================

/**
 * 获取用户的API Key配置
 * GET /api/user/api-keys
 */
router.get('/api-keys', authenticateToken, async (req, res, next) => {
    let connection;
    try {
        const userId = req.user.id;
        connection = await pool.getConnection();

        const [keys] = await connection.execute(
            `SELECT id, api_key, api_base_url, created_at, updated_at 
             FROM user_api_config 
             WHERE user_id = ?`,
            [userId]
        );

        if (keys.length === 0) {
            return res.json({
                success: true,
                data: null,
                has_key: false,
                message: '暂未配置API Key'
            });
        }

        const key = keys[0];
        
        // 对api_key进行脱敏处理，只显示开头和结尾
        const maskedKey = key.api_key.substring(0, 8) + '...' + key.api_key.substring(key.api_key.length - 4);

        res.json({
            success: true,
            data: {
                id: key.id,
                api_key_preview: maskedKey,
                api_base_url: key.api_base_url,
                created_at: key.created_at,
                updated_at: key.updated_at
            },
            has_key: true,
            message: '已配置API Key'
        });

    } catch (error) {
        console.error('获取API Key错误:', error);
        res.status(500).json({
            success: false,
            error: '获取API Key失败: ' + error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * 添加或更新用户的API Key
 * POST /api/user/api-keys
 * body: { api_key: "用户的Key", api_base_url: "API地址(可选)" }
 */
router.post('/api-keys', authenticateToken, async (req, res, next) => {
    let connection;
    try {
        const userId = req.user.id;
        const { api_key, api_base_url } = req.body;

        // 验证输入
        if (!api_key) {
            return res.status(400).json({
                success: false,
                error: '请输入API Key'
            });
        }

        if (api_key.length < 10) {
            return res.status(400).json({
                success: false,
                error: 'API Key格式不正确，长度过短'
            });
        }

        console.log(`📝 用户 ${userId} 配置API Key...`);

        connection = await pool.getConnection();

        // 检查用户是否已有API Key配置
        const [existingKeys] = await connection.execute(
            'SELECT id FROM user_api_config WHERE user_id = ?',
            [userId]
        );

        const baseUrl = api_base_url || 'https://flux-code.cc';
        const now = new Date();

        if (existingKeys.length > 0) {
            // 更新现有的API Key
            await connection.execute(
                `UPDATE user_api_config 
                 SET api_key = ?, api_base_url = ?, updated_at = ? 
                 WHERE user_id = ?`,
                [api_key, baseUrl, now, userId]
            );
            console.log(`✅ 用户 ${userId} 的API Key已更新`);
            
            res.json({
                success: true,
                message: '✅ API Key 更新成功！现在积分用完后可以使用此Key继续绘图。'
            });
        } else {
            // 创建新的API Key配置
            await connection.execute(
                `INSERT INTO user_api_config (user_id, api_key, api_base_url, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, api_key, baseUrl, now, now]
            );
            console.log(`✅ 用户 ${userId} 的API Key已保存`);
            
            res.json({
                success: true,
                message: '✅ API Key 配置成功！现在积分用完后可以使用此Key继续绘图。'
            });
        }

    } catch (error) {
        console.error('添加/更新API Key错误:', error);
        res.status(500).json({
            success: false,
            error: '操作失败: ' + error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * 删除API Key配置
 * DELETE /api/user/api-keys
 */
router.delete('/api-keys', authenticateToken, async (req, res, next) => {
    let connection;
    try {
        const userId = req.user.id;

        console.log(`🗑️ 用户 ${userId} 删除API Key...`);

        connection = await pool.getConnection();

        // 检查API Key是否存在
        const [existingKeys] = await connection.execute(
            'SELECT id FROM user_api_config WHERE user_id = ?',
            [userId]
        );

        if (existingKeys.length === 0) {
            return res.status(404).json({
                success: false,
                error: '您还未配置API Key'
            });
        }

        // 删除API Key
        await connection.execute(
            'DELETE FROM user_api_config WHERE user_id = ?',
            [userId]
        );

        console.log(`✅ 用户 ${userId} 的API Key已删除`);

        res.json({
            success: true,
            message: '✅ API Key 已删除'
        });

    } catch (error) {
        console.error('删除API Key错误:', error);
        res.status(500).json({
            success: false,
            error: '删除API Key失败: ' + error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * 测试API Key是否有效
 * POST /api/user/api-keys/test
 */
router.post('/api-keys/test', authenticateToken, async (req, res, next) => {
    let connection;
    try {
        const userId = req.user.id;
        const { api_key } = req.body;

        if (!api_key) {
            return res.status(400).json({
                success: false,
                error: '请提供API Key'
            });
        }

        console.log(`🧪 测试用户 ${userId} 的API Key...`);

        // 这里可以添加实际的API测试逻辑
        // 现在仅做简单的格式验证
        if (api_key.length < 10) {
            return res.status(400).json({
                success: false,
                error: 'API Key格式不正确'
            });
        }

        res.json({
            success: true,
            message: '✅ API Key 格式有效（完整验证需在调用API时进行）'
        });

    } catch (error) {
        console.error('测试API Key错误:', error);
        res.status(500).json({
            success: false,
            error: '测试失败: ' + error.message
        });
    }
});

module.exports = router;
