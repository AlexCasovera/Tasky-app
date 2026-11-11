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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      return res.status(200).json({
        success: false,
        reason: `Vendor blocked automated check (HTTP ${response.status}). Using manual price.`
      });
    }

    const html = await response.text();

    if (html.includes('captchacharacters') || html.includes('Robot Check') || html.includes('Access Denied')) {
      return res.status(200).json({
        success: false,
        reason: 'Vendor anti-bot CAPTCHA triggered. Please enter price manually.'
      });
    }

    // Comprehensive patterns covering Amazon, Instacart, Walmart, and generic JSON-LD / Microdata
    const patterns = [
      /"price"\s*:\s*"?(\d+(?:\.\d{1,2})?)"?/i,
      /property=["']product:price:amount["']\s+content=["'](\d+(?:\.\d{1,2})?)["']/i,
      /itemprop=["']price["']\s+content=["'](\d+(?:\.\d{1,2})?)["']/i,
      /"priceAmount"\s*:\s*"?(\d+(?:\.\d{1,2})?)"?/i,
      /class=["'][^"']*a-offscreen[^"']*["']>\s*\$(\d+(?:\.\d{1,2})?)\s*</i,
      /\$(\d+\.\d{2})/
    ];

    for (const regex of patterns) {
      const match = html.match(regex);
      if (match && match[1]) {
        const parsed = parseFloat(match[1]);
        if (!isNaN(parsed) && parsed > 0) {
          return res.status(200).json({
            success: true,
            price: parsed
          });
        }
      }
    }

    return res.status(200).json({
      success: false,
      reason: 'Could not auto-read price from URL. Please enter price manually.'
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      reason: `Fetch error: ${err.message}`
    });
  }
}