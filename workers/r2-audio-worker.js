export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    try {
      if (url.pathname === '/api/audio/list' && request.method === 'GET') {
        return json(await listObjects(env, url), cors);
      }

      if (url.pathname === '/api/audio/upload' && request.method === 'POST') {
        return json(await uploadObject(request, env), cors);
      }

      if (url.pathname === '/api/audio/delete' && request.method === 'DELETE') {
        await requireDeveloper(request, env);
        const key = url.searchParams.get('key');
        if (!key) {
          return json({ error: 'Missing key' }, cors, 400);
        }
        await env.AUDIO_BUCKET.delete(key);
        return json({ ok: true, key }, cors);
      }

      return json({ error: 'Not found' }, cors, 404);
    } catch (error) {
      const status = error.status || 500;
      return json({ error: error.message || 'Server error' }, cors, status);
    }
  }
};

async function listObjects(env, url) {
  const prefix = url.searchParams.get('prefix') || 'audio/';
  const listed = await env.AUDIO_BUCKET.list({
    prefix,
    limit: 1000,
    include: ['httpMetadata', 'customMetadata']
  });

  return {
    objects: listed.objects.map((object) => ({
      key: object.key,
      size: object.size,
      uploaded: object.uploaded,
      contentType: object.httpMetadata && object.httpMetadata.contentType,
      originalName: object.customMetadata && object.customMetadata.originalName
    }))
  };
}

async function uploadObject(request, env) {
  const maxBytes = 90 * 1024 * 1024;
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw httpError(413, 'File too large. Maximum is 90MB.');
  }

  if (env.UPLOAD_TOKEN) {
    const token = request.headers.get('x-upload-token') || '';
    if (token !== env.UPLOAD_TOKEN) {
      throw httpError(401, 'Upload token required');
    }
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    throw httpError(400, 'Missing file');
  }

  const contentType = file.type || guessContentType(file.name);
  if (!isAllowedAudio(contentType, file.name)) {
    throw httpError(415, 'Only audio files are accepted');
  }

  const key = buildAudioKey(file.name);
  await env.AUDIO_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable'
    },
    customMetadata: {
      originalName: sanitizeName(file.name)
    }
  });

  return {
    ok: true,
    key,
    size: file.size,
    contentType
  };
}

function requireDeveloper(request, env) {
  const expected = env.DEVELOPER_TOKEN;
  if (!expected) {
    throw httpError(500, 'DEVELOPER_TOKEN is not configured');
  }
  const actual = request.headers.get('x-developer-key') || '';
  if (actual !== expected) {
    throw httpError(403, 'Developer permission required');
  }
}

function buildAudioKey(name) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeName = sanitizeName(name);
  const id = crypto.randomUUID();
  return `audio/${year}/${month}/${id}-${safeName}`;
}

function sanitizeName(name) {
  return String(name || 'audio')
    .normalize('NFKD')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '-')
    .trim()
    .slice(0, 200) || 'audio';
}

function isAllowedAudio(contentType, name) {
  const type = String(contentType || '').toLowerCase();
  const lowerName = String(name || '').toLowerCase();
  return type.startsWith('audio/')
    || /\.(flac|wav|mp3|m4a|aac|ogg|opus)$/i.test(lowerName);
}

function guessContentType(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  return 'application/octet-stream';
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  const allowed = [
    'http://localhost:3000',
    'http://localhost:4173',
    'https://qianchanglys.top',
    'https://qianchang-official.github.io'
  ];
  const allowOrigin = allowed.includes(origin) || origin.endsWith('.github.io') ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-developer-key, x-upload-token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(payload, headers, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
