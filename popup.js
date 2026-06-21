function isIPAddress(hostname) {
  const ipPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
  return ipPattern.test(hostname);
}

function getMainDomain(hostname) {
  if (isIPAddress(hostname)) return hostname;

  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;

  const doubleExtensions = [
    'com.tr', 'co.uk', 'gov.uk', 'ac.ir', 'co.ir', 'sch.ir', 
    'gov.ir', 'org.ir', 'id.ir', 'net.tr', 'org.tr', 'com.au', 'co.jp'
  ];
  
  const lastTwo = parts.slice(-2).join('.');

  if (doubleExtensions.includes(lastTwo)) {
    return parts.slice(-3).join('.');
  } else {
    return parts.slice(-2).join('.');
  }
}

async function fetchDNSRecord(domain, type) {
  try {
    // حذف AbortSignal برای پایداری و سازگاری با همه نسخه‌های کروم
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=${type}`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (!response.ok) return [];
    const data = await response.json();
    return data.Answer || [];
  } catch (error) {
    console.error(`Error fetching ${type}:`, error);
    return [];
  }
}

async function getMXWithIPs(domain) {
  const mxRecords = await fetchDNSRecord(domain, 'MX');
  if (!mxRecords || mxRecords.length === 0) return 'No MX records found';

  const processedMX = await Promise.all(mxRecords.map(async (mx) => {
    if (!mx.data) return '';
    const parts = mx.data.split(' ');
    const priority = parts[0];
    const mailServer = parts[1] ? parts[1].replace(/\.$/, '') : '';

    if (!mailServer) return mx.data;

    const aRecords = await fetchDNSRecord(mailServer, 'A');
    const ips = aRecords.length > 0 ? aRecords.map(a => a.data).join(', ') : 'No IP mapped';

    return `${priority} ${mailServer} -> [ ${ips} ]`;
  }));

  return processedMX.filter(line => line !== '').join('\n');
}

document.addEventListener('DOMContentLoaded', async () => {
  const contentArea = document.getElementById('content-area');
  const domainDisplay = document.getElementById('domain-display');
  const intoDnsLink = document.getElementById('intodns-link');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      contentArea.innerHTML = '<div class="error">Cannot inspect this internal browser page.</div>';
      domainDisplay.textContent = 'Invalid Target';
      return;
    }

    const url = new URL(tab.url);
    const target = getMainDomain(url.hostname);
    
    domainDisplay.textContent = target;

    if (isIPAddress(target)) {
      intoDnsLink.style.display = 'none';
      contentArea.innerHTML = `
        <div class="info-box">
          <div class="info-item">
            <span class="label">Target Type</span>
            <div class="value" style="color: #28a745; font-weight: bold;">Direct IP Address</div>
          </div>
          <div class="info-item">
            <span class="label">IP Address</span>
            <div class="value">${target}</div>
          </div>
        </div>
      `;
      return;
    }

    intoDnsLink.href = `https://intodns.com/${target}`;
    intoDnsLink.style.display = 'block';

    const results = await Promise.allSettled([
      fetchDNSRecord(target, 'A'),
      fetchDNSRecord(`www.${target}`, 'A'),
      getMXWithIPs(target),
      fetchDNSRecord(target, 'NS')
    ]);

    const answersA = results[0].status === 'fulfilled' ? results[0].value : [];
    const answersWWW = results[1].status === 'fulfilled' ? results[1].value : [];
    const mxString = results[2].status === 'fulfilled' ? results[2].value : 'Failed to fetch MX';
    const answersNS = results[3].status === 'fulfilled' ? results[3].value : [];

    const recordA = answersA.length > 0 ? answersA.map(a => a.data).join('\n') : 'No records found';
    const recordWWW = answersWWW.length > 0 ? answersWWW.map(a => a.data).join('\n') : 'No records found';
    const recordNS = answersNS.length > 0 ? answersNS.map(ns => ns.data).join('\n') : 'No records found';

    contentArea.innerHTML = `
      <div class="info-box">
        <div class="info-item">
          <span class="label">A Record (Root)</span>
          <div class="value">${recordA}</div>
        </div>
        <div class="info-item">
          <span class="label">A Record (WWW)</span>
          <div class="value">${recordWWW}</div>
        </div>
        <div class="info-item">
          <span class="label">MX Records & IPs</span>
          <div class="value" style="color: #0066cc; white-space: pre-wrap;">${mxString}</div>
        </div>
        <div class="info-item">
          <span class="label">Name Servers (NS)</span>
          <div class="value">${recordNS}</div>
        </div>
      </div>
    `;

  } catch (err) {
    contentArea.innerHTML = `<div class="error">Critical error occurred: ${err.message}</div>`;
  }
});