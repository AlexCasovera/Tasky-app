// api/sync-price.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body || {};
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Please provide a valid product URL.' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      return res.status(200).json({
        success: false,
        reason: `Vendor blocked automated check (HTTP ${response.status}). Using manual price.`
      });
    }

    const html = await response.text();

    // Check for anti-bot or CAPTCHA challenges
    if (html.includes('captchacharacters') || html.includes('Robot Check') || html.includes('Access Denied')) {
      return res.status(200).json({
        success: false,
        reason: 'Vendor anti-bot CAPTCHA triggered. Please use manual price.'
      });
    }

    // Tier 1: Explicit Amazon Active Selected Variation Containers
    const amazonVariationPatterns = [
      /class=["'][^"']*priceToPay[^"']*["'][\s\S]*?<span class=["']a-offscreen["']>\s*\$([0-9]+\.[0-9]{2})\s*<\/span>/i,
      /id=["']corePriceDisplay_desktop_feature_div["'][\s\S]*?<span class=["']a-offscreen["']>\s*\$([0-9]+\.[0-9]{2})\s*<\/span>/i,
      /id=["']corePrice_feature_div["'][\s\S]*?<span class=["']a-offscreen["']>\s*\$([0-9]+\.[0-9]{2})\s*<\/span>/i,
      /class=["'][^"']*apexPriceToPay[^"']*["'][\s\S]*?<span class=["']a-offscreen["']>\s*\$([0-9]+\.[0-9]{2})\s*<\/span>/i,
      /data-csa-c-buying-option-price=["']\$?([0-9]+\.[0-9]{2})["']/i,
      /id=["']priceblock_(?:ourprice|dealprice)["'][^>]*>\s*\$([0-9]+\.[0-9]{2})/i
    ];

    for (const regex of amazonVariationPatterns) {
      const match = html.match(regex);
      if (match && match[1]) {
        const parsed = parseFloat(match[1]);
        if (!isNaN(parsed) && parsed > 0) {
          return res.status(200).json({ success: true, price: parsed });
        }
      }
    }

    // Tier 2: Standard E-Commerce Structured Metadata (OpenGraph & Schema.org)
    const structuredMetadataPatterns = [
      /property=["'](?:og|product):price:amount["']\s+content=["']([0-9]+\.[0-9]{2})["']/i,
      /content=["']([0-9]+\.[0-9]{2})["']\s+property=["'](?:og|product):price:amount["']/i,
      /itemprop=["']price["']\s+content=["']([0-9]+\.[0-9]{2})["']/i,
      /content=["']([0-9]+\.[0-9]{2})["']\s+itemprop=["']price["']/i,
      /"price"\s*:\s*"([0-9]+\.[0-9]{2})"/i
    ];

    for (const regex of structuredMetadataPatterns) {
      const match = html.match(regex);
      if (match && match[1]) {
        const parsed = parseFloat(match[1]);
        if (!isNaN(parsed) && parsed > 0) {
          return res.status(200).json({ success: true, price: parsed });
        }
      }
    }

    // Tier 3: Human-Visible Standard Dollar Amounts ($X.XX)
    const visiblePriceMatches = [...html.matchAll(/\$([0-9]{1,4}\.[0-9]{2})/g)];
    if (visiblePriceMatches.length > 0) {
      // Find the first sensible price that isn't $0.00
      for (const m of visiblePriceMatches) {
        const val = parseFloat(m[1]);
        if (!isNaN(val) && val > 0.50) {
          return res.status(200).json({ success: true, price: val });
        }
      }
    }

    // Tier 4: Shopify Raw Cents Fallback (e.g., "price": 219 -> 2.19)
    const rawCentsMatch = html.match(/"price"\s*:\s*([0-9]{3,6})/i);
    if (rawCentsMatch && rawCentsMatch[1]) {
      const centsVal = parseFloat(rawCentsMatch[1]) / 100;
      if (!isNaN(centsVal) && centsVal > 0) {
        return res.status(200).json({ success: true, price: centsVal });
      }
    }

    return res.status(200).json({
      success: false,
      reason: 'Could not detect price on page. Please enter price manually.'
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      reason: `Fetch error: ${err.message}`
    });
  }
}