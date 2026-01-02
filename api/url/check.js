export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, reason: 'Method not allowed' });
    return;
  }

  const isPrivateHostname = (hostname) => {
    const h = String(hostname || '').toLowerCase();
    if (!h) return true;
    if (h === 'localhost' || h.endsWith('.localhost')) return true;
    if (h === '0.0.0.0' || h === '127.0.0.1') return true;
    if (/^10\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
    return false;
  };

  try {
    const url = String(req.query.url || '').trim();
    if (!url) {
      res.status(400).json({ ok: false, reason: 'Missing url' });
      return;
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      res.status(400).json({ ok: false, reason: 'Invalid url' });
      return;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      res.status(400).json({ ok: false, reason: 'Unsupported protocol' });
      return;
    }

    if (isPrivateHostname(parsed.hostname)) {
      res.status(400).json({ ok: false, reason: 'Blocked hostname' });
      return;
    }

    let resp = await fetch(parsed.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OneOriginHub/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!resp.ok || resp.status === 405) {
      resp = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OneOriginHub/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Range': 'bytes=0-2048',
        },
      });
    }

    const contentType = resp.headers.get('content-type') || '';
    const ok = resp.status >= 200 && resp.status < 400 && /text\/html|application\/xhtml\+xml/i.test(contentType);

    res.status(200).json({ ok, status: resp.status, contentType, finalUrl: resp.url });
  } catch (error) {
    res.status(500).json({ ok: false, reason: error?.message || 'Unknown error' });
  }
}
