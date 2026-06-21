# intoDNS Quick Inspector

A lightweight, developer-focused Chrome Extension that instantly queries and displays essential DNS records (`A`, `MX` with mapped IPs, and `NS`) for the active browser tab, providing a seamless one-click link to a full detailed report on intoDNS.

![intoDNS Quick Inspector Icon](intodns-extension/icon.png)

## Features

* **Instant DNS Snapshot:** Displays Root `A`, `WWW A`, `MX`, and `NS` records without leaving your current tab.
* **Smart MX IP Mapping:** Automatically resolves and prints the IP addresses next to each MX server for easier infrastructure debugging.
* **Deep Linking:** Generates a direct link to the full domain report on `intoDNS.com`.
* **Smart Domain Parsing:** Correctly handles standard domains, Direct IP inputs, and multi-part extensions (e.g., `.co.uk`, `.ac.ir`, `.com.tr`).
* **Clean Monospace UI:** Designed with a compact, highly scannable layout suitable for SysAdmins and DevOps engineers.
* **Privacy & Efficiency:** Uses public secure DNS-over-HTTPS (Google DNS API) without requiring heavy background scripts.

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
3.  It communicates directly with `https://dns.google/resolve` using lightweight asynchronous fetches.
4.  It populates the popup interface dynamically while providing a quick action button to open the extensive test results on intoDNS.

## File Structure

```text
├── intodns-extension/
│   ├── manifest.json    # Extension configuration (Manifest V3)
│   ├── popup.html       # Popup layout & styling
│   ├── popup.js         # Domain parsing, DNS querying & UI logic
│   └── icon.png         # Extension toolbar icon
└── README.md
