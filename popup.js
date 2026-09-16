// DoH resolvers tried in order; all speak the same JSON API (Accept: application/dns-json).
// IP-based endpoints come first on purpose: they need no system DNS resolution at all,
// so they keep working when the local resolver blocks or poisons resolver hostnames
// (e.g. "dns.google" answering SERVFAIL on heavily filtered networks).
const RESOLVER_ENDPOINTS = [
  'https://8.8.8.8/resolve',
  'https://1.1.1.1/dns-query',
  'https://dns.google/resolve',
  'https://cloudflare-dns.com/dns-query'
];

const FETCH_TIMEOUT_MS = 5000; // per resolver attempt
let lastWorkingResolver = 0;   // cached per popup session to skip re-probing

// Two-letter public suffixes that need one extra label kept as the main domain.
const DOUBLE_SUFFIXES = [
  'com.tr', 'net.tr', 'org.tr',
  'co.uk', 'gov.uk',
  'ac.ir', 'co.ir', 'gov.ir', 'id.ir', 'net.ir', 'org.ir', 'sch.ir',
  'com.au', 'co.jp'
];

function isIPv4Address(hostname) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  // Each octet must actually be in range, e.g. 999.1.1.1 is not a valid IP.
  return match.slice(1).every((octet) => Number(octet) <= 255);
}

function isIPv6Address(hostname) {
  // url.hostname keeps the brackets for IPv6 literals, e.g. "[2606:4700::1111]".
  return hostname.startsWith('[') && hostname.endsWith(']');
}

function isIPAddress(hostname) {
  return isIPv4Address(hostname) || isIPv6Address(hostname);
}

function normalizeHostname(hostname) {
  // Trailing dots ("example.com.") and letter case are insignificant for DNS lookups.
  return hostname.replace(/\.+$/, '').toLowerCase();
}

function getMainDomain(hostname) {
  if (isIPAddress(hostname)) return hostname;

  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;

  const lastTwo = parts.slice(-2).join('.');
  return DOUBLE_SUFFIXES.includes(lastTwo)
    ? parts.slice(-3).join('.')
    : parts.slice(-2).join('.');
}

// Returns the Answer array on success, or { failed: true, reason } on failure.
// An empty Answer array still means "no records" (e.g. NXDOMAIN), not a failure.
function lookupFailed(records) {
  return records == null || records.failed === true;
}

function failureReason(records) {
  return records && records.reason ? ` (${records.reason})` : '';
}

function describeFetchError(error) {
  if (error && error.name === 'TimeoutError') return 'timed out';
  if (error && error.name === 'AbortError') return 'aborted';
  return 'network/service error';
}

async function queryResolver(endpoint, domain, type) {
  // AbortSignal.timeout exists since Chrome 103; fall back to no timeout on older builds.
  const signal = typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
    : undefined;

  const response = await fetch(`${endpoint}?name=${encodeURIComponent(domain)}&type=${type}`, {
    headers: { 'Accept': 'application/dns-json' },
    signal
  });

  if (!response.ok) {
    console.warn(`${endpoint} returned HTTP ${response.status} for ${type} record of ${domain}`);
    return null;
  }
  return response.json();
}

async function fetchDNSRecord(domain, type) {
  // Probe the last working resolver first, then every other endpoint in order.
  const endpoints = [
    RESOLVER_ENDPOINTS[lastWorkingResolver],
    ...RESOLVER_ENDPOINTS.filter((_, index) => index !== lastWorkingResolver)
  ];

  let lastReason = 'network/service error';

  for (const endpoint of endpoints) {
    try {
      const data = await queryResolver(endpoint, domain, type);
      if (!data || typeof data.Status !== 'number') {
        lastReason = 'invalid response';
        continue;
      }
      lastWorkingResolver = RESOLVER_ENDPOINTS.indexOf(endpoint);
      // An empty Answer (e.g. NXDOMAIN) is a valid answer, not a failure.
      return data.Answer || [];
    } catch (error) {
      lastReason = describeFetchError(error);
      console.warn(`${endpoint} failed for ${type} of ${domain}: ${lastReason}`, error);
    }
  }

  console.error(`All DoH resolvers failed for ${type} record of ${domain} (last reason: ${lastReason})`);
  return { failed: true, reason: `all resolvers failed: ${lastReason}` };
}

function formatRecords(records, domain, type) {
  if (lookupFailed(records)) return `Lookup failed for ${type} record${failureReason(records)}`;
  if (records.length === 0) return `No ${type} records found for ${domain}`;
  return records.map((record) => record.data).join('\n');
}

async function getMXWithIPs(domain) {
  const mxRecords = await fetchDNSRecord(domain, 'MX');
  if (lookupFailed(mxRecords)) return `MX lookup failed${failureReason(mxRecords)}`;
  if (mxRecords.length === 0) return 'No MX records found';

  const processedMX = await Promise.all(mxRecords.map(async (mx) => {
    if (!mx.data) return '';

    const parts = mx.data.trim().split(/\s+/);
    const priority = parts[0];
    const mailServer = parts[1] ? parts[1].replace(/\.$/, '') : '';

    if (!mailServer) return mx.data;

    const aRecords = await fetchDNSRecord(mailServer, 'A');
    const ips = lookupFailed(aRecords)
      ? `Lookup failed${failureReason(aRecords)}`
      : (aRecords.length > 0 ? aRecords.map((a) => a.data).join(', ') : 'No IP mapped');

    return `${priority} ${mailServer} -> [ ${ips} ]`;
  }));

  const lines = processedMX.filter((line) => line !== '');
  return lines.length > 0 ? lines.join('\n') : 'No MX records found';
}

// Build the results box with textContent only, so DNS data can never inject HTML.
function renderInfoBox(contentArea, rows) {
  const box = document.createElement('div');
  box.className = 'info-box';

  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'info-item';

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = row.label;

    const value = document.createElement('div');
    value.className = row.valueClass ? `value ${row.valueClass}` : 'value';
    value.textContent = row.value;

    item.append(label, value);
    box.appendChild(item);
  }

  contentArea.replaceChildren(box);
}

function renderError(contentArea, message) {
  const errorBox = document.createElement('div');
  errorBox.className = 'error';
  errorBox.textContent = message;
  contentArea.replaceChildren(errorBox);
}

document.addEventListener('DOMContentLoaded', async () => {
  const contentArea = document.getElementById('content-area');
  const domainDisplay = document.getElementById('domain-display');
  const intoDnsLink = document.getElementById('intodns-link');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    let url = null;
    try {
      url = tab && tab.url ? new URL(tab.url) : null;
    } catch {
      url = null;
    }

    // Only http(s) pages have a publicly resolvable domain; this single check also
    // covers chrome://, edge://, about:, file://, view-source:, extension pages, etc.
    if (!url || !/^https?:$/.test(url.protocol) || !url.hostname) {
      domainDisplay.textContent = 'Invalid Target';
      renderError(contentArea, 'Cannot inspect this page. Open a normal http(s) website first.');
      return;
    }

    const target = getMainDomain(normalizeHostname(url.hostname));
    domainDisplay.textContent = target;

    if (isIPAddress(target)) {
      intoDnsLink.style.display = 'none';
      renderInfoBox(contentArea, [
        { label: 'Target Type', value: 'Direct IP Address', valueClass: 'success' },
        { label: 'IP Address', value: target.replace(/^\[|\]$/g, '') }
      ]);
      return;
    }

    intoDnsLink.href = `https://intodns.com/${encodeURIComponent(target)}`;
    intoDnsLink.style.display = 'block';

    const results = await Promise.allSettled([
      fetchDNSRecord(target, 'A'),
      fetchDNSRecord(`www.${target}`, 'A'),
      getMXWithIPs(target),
      fetchDNSRecord(target, 'NS')
    ]);

    // Each helper already catches its own errors; a rejected promise here still
    // means "failed" rather than "empty", so it renders as a lookup failure.
    const resultValue = (index) => (results[index].status === 'fulfilled' ? results[index].value : null);

    const aRoot = resultValue(0);
    const aWWW = resultValue(1);
    const mxText = resultValue(2) ?? 'MX lookup failed';
    const nsRecords = resultValue(3);

    // Every query failing at once points to a connectivity problem, not missing records.
    if ([aRoot, aWWW, nsRecords].every(lookupFailed) && mxText.startsWith('MX lookup failed')) {
      renderError(contentArea, 'All DNS-over-HTTPS resolvers are unreachable from this network. Check your internet connection, firewall, or DNS filtering.');
      return;
    }

    renderInfoBox(contentArea, [
      { label: 'A Record (Root)', value: formatRecords(aRoot, target, 'A') },
      { label: 'A Record (WWW)', value: formatRecords(aWWW, `www.${target}`, 'A') },
      { label: 'MX Records & IPs', value: mxText, valueClass: 'mx' },
      { label: 'Name Servers (NS)', value: formatRecords(nsRecords, target, 'NS') }
    ]);
  } catch (err) {
    domainDisplay.textContent = 'Error';
    renderError(contentArea, `Critical error occurred: ${err.message}`);
  }
});
