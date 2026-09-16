# intoDNS Quick Inspector

A lightweight, developer-focused Chrome Extension that instantly queries and displays essential DNS records (`A`, `MX` with mapped IPs, and `NS`) for the active browser tab, providing a seamless one-click link to a full detailed report on intoDNS.

![intoDNS Quick Inspector Icon](icon.png)

## Features

* **Instant DNS Snapshot:** Displays Root `A`, `WWW A`, `MX`, and `NS` records without leaving your current tab.
* **Smart MX IP Mapping:** Automatically resolves and prints the IP addresses next to each MX server for easier infrastructure debugging.
* **Deep Linking:** Generates a direct link to the full domain report on `intoDNS.com`.
* **Smart Domain Parsing:** Correctly handles standard domains, direct IP inputs (IPv4 & IPv6 literals), and multi-part extensions (e.g., `.co.uk`, `.ac.ir`, `.com.tr`).
* **Clean Monospace UI:** Designed with a compact, highly scannable layout suitable for SysAdmins and DevOps engineers.
* **Resilient Resolver Chain:** Queries DNS-over-HTTPS with automatic fallback across four endpoints — `8.8.8.8` → `1.1.1.1` → `dns.google` → `cloudflare-dns.com`. IP-based endpoints are tried first, so the extension keeps working on networks where resolver hostnames are DNS-blocked or poisoned. The working resolver is cached per popup session.
* **Honest Error Reporting:** Clearly distinguishes *"No records found"* from *"Lookup failed"* and shows the underlying reason (timeout, network/service error, or HTTP status). If every resolver is unreachable, a single clear connectivity message is shown instead of four separate failures.
* **Privacy & Efficiency:** Pure client-side logic — no background service worker, no analytics, no data storage; DNS queries go only to the public DoH endpoints listed above.

## Installation

### For Developers / Manual Install
Since this extension is optimized for quick local use and deployment, you can load it directly into Google Chrome or any Chromium-based browser (Edge, Brave, Opera):

1.  **Download** or clone this repository to your local machine.
2.  Open your browser and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** (toggle switch in the top-right corner).
4.  Click on the **Load unpacked** button in the top-left corner.
5.  Select the `intodns-extension` folder containing the `manifest.json` file.
6.  The extension is now installed! Pin it to your toolbar for easy access.

## How It Works

1.  Clicking the extension icon retrieves the hostname of your currently active tab.
2.  The extension extracts the primary apex/main domain (filtering out subdomains or custom internal protocols).
3.  It queries the DNS-over-HTTPS JSON APIs (`Accept: application/dns-json`) through a fallback chain of Google and Cloudflare resolvers (`8.8.8.8`, `1.1.1.1`, `dns.google`, `cloudflare-dns.com`), remembering whichever endpoint answered first.
4.  It populates the popup interface dynamically while providing a quick action button to open the extensive test results on intoDNS.

## File Structure

```text
intodns-extension/
├── manifest.json    # Extension configuration (Manifest V3)
├── popup.html       # Popup layout & styling
├── popup.js         # Domain parsing, resolver fallback chain & UI logic
├── icon.png         # Source icon (400×400)
├── icon16.png       # Toolbar icon (16×16)
├── icon48.png       # Extensions page icon (48×48)
├── icon128.png      # Web Store / install icon (128×128)
├── README.md
└── LICENSE.txt
```

## Permissions & Privacy

* **`activeTab`** — grants temporary access to the active tab's URL only when you open the popup. The extension does not request the broad `tabs` permission, so it never gains standing access to your browsing history.
* **Host permissions** are limited to the four DoH endpoints above (`dns.google`, `8.8.8.8`, `1.1.1.1`, `cloudflare-dns.com`) — nothing else on the web is contacted.
* No storage permission, no remote code, no tracking.

## Troubleshooting

* **Popup shows "All DNS-over-HTTPS resolvers are unreachable…"** — your network is blocking all four resolver endpoints (common on heavily filtered networks). Verify reachability from a terminal:
  ```bash
  curl -m 8 'https://8.8.8.8/resolve?name=example.com&type=A'
  curl -m 8 -H 'accept: application/dns-json' 'https://1.1.1.1/dns-query?name=example.com&type=A'
  ```
  If both fail, check your firewall, DNS filtering, or VPN.
* **Seeing console logs** — right-click inside the popup → **Inspect** → **Console**. Popup logs exist only while the popup is open.

## License

Released under the [MIT License](LICENSE.txt).
