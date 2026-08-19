import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';

let upstreamServer: http.Server | null = null;
let proxyProcess: ReturnType<typeof spawn> | null = null;
let proxyPort = 0;
let upstreamPort = 0;
let upstreamCalls = 0;
let serveFailure = false;
let upstreamShouldFail = false;

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve(address.port);
        return;
      }
      reject(new Error('failed to bind server'));
    });
  });
}

function waitForProxyReady(proc: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('proxy did not start in time'));
    }, 10000);

    const onData = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      if (text.includes('API proxy listening')) {
        clearTimeout(timeout);
        proc.stdout?.off('data', onData);
        proc.stderr?.off('data', onData);
        resolve();
      }
    };

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`proxy exited early with code ${code ?? 'unknown'}`));
    });
  });
}

beforeAll(async () => {
  upstreamServer = http.createServer((req, res) => {
    upstreamCalls += 1;
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (url.pathname.includes('storeListInDong')) {
      if (!serveFailure) {
        serveFailure = true;
        res.writeHead(429, {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': '0'
        });
        res.end(JSON.stringify({ error: 'rate_limited' }));
        return;
      }

      if (upstreamShouldFail) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'upstream_down' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        body: {
          totalCount: 1,
          items: [{ row: [{ storeNm: '테스트 카페', pnu: '1111111111' }] }]
        }
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  upstreamPort = await listen(upstreamServer);
  const proxyProbe = http.createServer();
  proxyPort = await listen(proxyProbe);
  proxyProbe.close();

  proxyProcess = spawn(process.execPath, ['server/proxy.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(proxyPort),
      SBDC_API_BASE_URL: `http://127.0.0.1:${upstreamPort}/proxy`,
      REB_API_BASE_URL: 'http://127.0.0.1:9999',
      KOSIS_API_BASE_URL: 'http://127.0.0.1:9998',
      FTC_API_BASE_URL: 'http://127.0.0.1:9997'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await waitForProxyReady(proxyProcess);
});

afterAll(async () => {
  proxyProcess?.kill();
  upstreamServer?.close();
});

describe('proxy resilience', () => {
  it('retries 429 responses once and dedupes concurrent identical requests', async () => {
    const target = `http://127.0.0.1:${proxyPort}/commercial-district?province=충청남도&district=천안시&neighborhood=불당동&industryId=cafe`;
    const [first, second] = await Promise.all([fetch(target), fetch(target)]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(upstreamCalls).toBe(2);

    const payload = await first.json();
    expect(payload.source).toBe('sbdc');
    expect(payload.isRealData).toBe(true);
  });

  it('serves cached upstream responses when the upstream later fails', async () => {
    upstreamShouldFail = true;
    const target = `http://127.0.0.1:${proxyPort}/commercial-district?province=충청남도&district=천안시&neighborhood=불당동&industryId=cafe`;
    const response = await fetch(target);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.competitorExamples.length).toBeGreaterThan(0);
    expect(upstreamCalls).toBeGreaterThanOrEqual(3);
  });
});
