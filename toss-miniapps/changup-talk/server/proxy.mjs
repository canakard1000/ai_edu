import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const port = Number(process.env.PORT || 8787);
const dotenvFiles = ['.env.local', '.env'];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

for (const fileName of dotenvFiles) {
  loadEnvFile(path.resolve(process.cwd(), fileName));
}

const sbdcBase = process.env.SBDC_API_BASE_URL || 'http://apis.data.go.kr/B553077/api/open/sdsc2';
const rebBase = process.env.REB_API_BASE_URL || 'https://www.reb.or.kr/r-one/openapi';
const kosisBase = process.env.KOSIS_API_BASE_URL || 'https://kosis.kr/openapi';
const ftcBase = process.env.FTC_API_BASE_URL || '';

const keys = {
  sbdc: process.env.SBDC_API_KEY || process.env.VITE_SBDC_API_KEY || '',
  reb: process.env.REB_API_KEY || process.env.VITE_REB_API_KEY || '',
  kosis: process.env.KOSIS_API_KEY || process.env.VITE_KOSIS_API_KEY || '',
  ftc: process.env.FTC_API_KEY || process.env.VITE_FTC_API_KEY || ''
};

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
}

function sendJson(res, statusCode, payload) {
  withCors(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function maskedStatus() {
  return {
    SBDC_API_KEY: keys.sbdc ? 'SET' : 'UNSET',
    REB_API_KEY: keys.reb ? 'SET' : 'UNSET',
    KOSIS_API_KEY: keys.kosis ? 'SET' : 'UNSET',
    FTC_API_KEY: keys.ftc ? 'SET' : 'UNSET'
  };
}

async function proxyRequest(req, res, baseUrl, key) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const upstream = new URL(baseUrl);
  upstream.pathname = `${upstream.pathname.replace(/\/$/, '')}${requestUrl.pathname}`;
  upstream.search = requestUrl.search;

  if (key && !upstream.searchParams.has('serviceKey')) {
    upstream.searchParams.set('serviceKey', key);
  }

  const response = await fetch(upstream, {
    method: req.method,
    headers: {
      accept: req.headers.accept || 'application/json'
    }
  });

  const contentType = response.headers.get('content-type') || 'application/json; charset=utf-8';
  const body = await response.text();
  withCors(res);
  res.writeHead(response.status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/health') {
      sendJson(res, 200, { ok: true, keys: maskedStatus() });
      return;
    }

    if (url.pathname.startsWith('/sbdc')) {
      await proxyRequest(req, res, sbdcBase, keys.sbdc);
      return;
    }

    if (url.pathname.startsWith('/reb')) {
      await proxyRequest(req, res, rebBase, keys.reb);
      return;
    }

    if (url.pathname.startsWith('/kosis')) {
      await proxyRequest(req, res, kosisBase, keys.kosis);
      return;
    }

    if (url.pathname.startsWith('/ftc')) {
      if (!ftcBase) {
        sendJson(res, 501, {
          error: 'FTC_API_BASE_URL not configured',
          message: '공정거래위원회 API의 실제 스펙이 확인된 뒤 서버 비밀값으로 연결하세요.'
        });
        return;
      }

      await proxyRequest(req, res, ftcBase, keys.ftc);
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  } catch (error) {
    sendJson(res, 500, {
      error: 'proxy_error',
      message: error instanceof Error ? error.message : 'unknown error'
    });
  }
});

server.listen(port, () => {
  console.log(`API proxy listening on http://127.0.0.1:${port}`);
  console.log(`API key status: ${JSON.stringify(maskedStatus())}`);
});
