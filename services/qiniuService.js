const qiniu = require('qiniu');
const axios = require('axios');

// 从环境变量或传入配置读取七牛配置
function getConfig(overrides) {
  return {
    accessKey: overrides?.accessKey || process.env.QINIU_ACCESS_KEY || '',
    secretKey: overrides?.secretKey || process.env.QINIU_SECRET_KEY || '',
    bucket: overrides?.bucket || process.env.QINIU_BUCKET || '',
    domain: overrides?.domain || process.env.QINIU_DOMAIN || '',
  };
}

function getUploadToken(config, key) {
  const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
  const putPolicy = new qiniu.rs.PutPolicy({ scope: `${config.bucket}:${key}` });
  return putPolicy.uploadToken(mac);
}

/**
 * 从远程 URL 下载图片后上传到七牛 OSS
 */
async function uploadFromUrl(remoteUrl, key, configOverrides) {
  const config = getConfig(configOverrides);
  if (!config.accessKey || !config.secretKey || !config.bucket || !config.domain) {
    throw new Error('七牛云配置不完整');
  }

  const response = await axios({ url: remoteUrl, responseType: 'arraybuffer', timeout: 120000 });
  const buffer = Buffer.from(response.data);

  return uploadBuffer(buffer, key, config);
}

/**
 * 直接上传 Buffer 到七牛 OSS
 */
async function uploadBuffer(buffer, key, configOverrides) {
  const config = getConfig(configOverrides);
  if (!config.accessKey || !config.secretKey || !config.bucket || !config.domain) {
    throw new Error('七牛云配置不完整');
  }

  const token = getUploadToken(config, key);
  const formUploader = new qiniu.form_up.FormUploader(new qiniu.conf.Config());
  const putExtra = new qiniu.form_up.PutExtra();

  return new Promise((resolve, reject) => {
    formUploader.put(token, key, buffer, putExtra, (err, body, info) => {
      if (err) return reject(err);
      if (info.statusCode === 200) {
        resolve(key);
      } else {
        reject(new Error(`七牛上传失败: ${info.statusCode} - ${JSON.stringify(body)}`));
      }
    });
  });
}

/**
 * 根据存储 key 构建完整的公开访问 URL
 * 兼容旧数据：如果已经是完整 URL 或 /uploads/ 路径则原样返回
 */
function buildPublicUrl(key, configOverrides) {
  if (!key) return key;
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  if (key.startsWith('/uploads/')) return key;
  const config = getConfig(configOverrides);
  if (!config.domain) return key;
  const domain = config.domain.replace(/\/+$/, '');
  return `${domain}/${key}`;
}

module.exports = { uploadFromUrl, uploadBuffer, buildPublicUrl };
