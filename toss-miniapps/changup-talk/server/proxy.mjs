import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const port = Number(process.env.PORT || 8787);
const dotenvFiles = ['.env.local', '.env'];
const defaultBases = {
  sbdc: 'http://apis.data.go.kr/B553077/api/open/sdsc2',
  reb: 'https://www.reb.or.kr/r-one/openapi',
  kosis: 'https://kosis.kr/openapi',
  ftc: 'https://apis.data.go.kr/1130000/FftcbrandfrcsbzmnothctinfoService'
};

const ftcOperationPath = '/getbrandFrcsBzmnOthctinfo';

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

function normalizeBaseUrl(service, rawValue) {
  if (!rawValue) {
    return defaultBases[service];
  }

  try {
    const parsed = new URL(rawValue);
    const looksLikePage = parsed.hash.length > 0
      || /\/portal\/|\/serviceUse\/|ActKeyPage|serviceUseUnityReg|Detail\.do$/i.test(parsed.pathname)
      || parsed.pathname === '/' || parsed.pathname === '';
    return looksLikePage ? defaultBases[service] : rawValue;
  } catch {
    return defaultBases[service];
  }
}

function normalizeApiKey(rawValue) {
  if (!rawValue) {
    return '';
  }

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

const sbdcBase = normalizeBaseUrl('sbdc', process.env.SBDC_API_BASE_URL);
const rebBase = normalizeBaseUrl('reb', process.env.REB_API_BASE_URL);
const kosisBase = normalizeBaseUrl('kosis', process.env.KOSIS_API_BASE_URL);
const ftcBase = normalizeBaseUrl('ftc', process.env.FTC_API_BASE_URL);

const keys = {
  sbdc: normalizeApiKey(process.env.SBDC_API_KEY || process.env.VITE_SBDC_API_KEY || ''),
  reb: normalizeApiKey(process.env.REB_API_KEY || process.env.VITE_REB_API_KEY || ''),
  kosis: normalizeApiKey(process.env.KOSIS_API_KEY || process.env.VITE_KOSIS_API_KEY || ''),
  ftc: normalizeApiKey(process.env.FTC_API_KEY || process.env.VITE_FTC_API_KEY || '')
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

async function proxyRequest(req, res, baseUrl, key, pathnameOverride = null) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const upstream = new URL(baseUrl);
  const requestPath = pathnameOverride ?? requestUrl.pathname;
  upstream.pathname = `${upstream.pathname.replace(/\/$/, '')}${requestPath}`;
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

async function probeUrl(urlString, keyName, key, extraParams = {}) {
  const url = new URL(urlString);
  Object.entries(extraParams).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(name, String(value));
    }
  });
  if (key) {
    url.searchParams.set(keyName, key);
  }

  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/xml;q=0.9, */*;q=0.8'
    }
  });
  const body = await response.text();
  return {
    url: url.toString(),
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get('content-type') || '',
    bodyPreview: body.slice(0, 500)
  };
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

    if (url.pathname === '/probe/sbdc') {
      const result = await probeUrl(`${sbdcBase.replace(/\/$/, '')}/storeZoneOne`, 'serviceKey', keys.sbdc, {
        key: '9174',
        type: 'json'
      });
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/probe/reb') {
      const result = await probeUrl(`${rebBase.replace(/\/$/, '')}/SttsApiTblData.do`, 'KEY', keys.reb, {
        STATBL_ID: 'A_2024_00903',
        DTACYCLE_CD: 'MM',
        CLS_ID: '500001',
        ITM_ID: '100001',
        START_WRTTIME: '2025',
        Type: 'json'
      });
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/probe/kosis') {
      const result = await probeUrl(`${kosisBase.replace(/\/$/, '')}/statisticsList.do`, 'apiKey', keys.kosis, {
        method: 'getList',
        vwCd: 'MT_ZTITLE',
        parentId: 'A',
        format: 'json'
      });
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/probe/ftc') {
      const result = await probeUrl(`${ftcBase.replace(/\/$/, '')}${ftcOperationPath}`, 'serviceKey', keys.ftc, {
        pageNo: '1',
        numOfRows: '10',
        resultType: 'json',
        jngBizCrtraYr: '2017',
        brandMnno: 'BRD_20080100007'
      });
      sendJson(res, 200, result);
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

      if (url.pathname === '/ftc/franchise-info' || url.pathname === '/ftc/getbrandFrcsBzmnOthctinfo') {
        await proxyRequest(req, res, ftcBase, keys.ftc, ftcOperationPath);
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
