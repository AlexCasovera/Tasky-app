// api/ai-qc-check.js
import { createClient } from '@supabase/supabase-js';

async function urlToInlineData(imageUrl) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch image (${imgRes.status}): ${imageUrl}`);
  }
  const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await imgRes.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  return {
    inlineData: {
      mimeType,
      data: base64Data
    }
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials in Vercel Environment Variables.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { submittedImageUrl, propertyName, unitName, selectedRuleIds } = req.body || {};
  if (!submittedImageUrl || !propertyName || !unitName) {
    return res.status(400).json({ error: 'Missing submittedImageUrl, propertyName, or unitName.' });
  }

  try {
    const { data: unitData, error: unitErr } = await supabase
      .from('property_units')
      .select('*')
      .eq('property_name', propertyName)
      .eq('unit_name', unitName)
      .single();

    if (unitErr || !unitData) {
      return res.status(200).json({ success: true, passed: true, feedback: 'Unit not configured; auto-passed.' });
    }

    const unitBlueprints = Array.isArray(unitData.blueprints) && unitData.blueprints.length > 0
      ? unitData.blueprints
      : (unitData.blueprint ? [unitData.blueprint] : []);

    const { data: allRules, error: rulesErr } = await supabase
      .from('ai_qc_rules')
      .select('*')
      .in('blueprint', unitBlueprints)
      .eq('active', true);

    if (rulesErr) throw rulesErr;

    const activeRules = (selectedRuleIds && selectedRuleIds.length > 0)
      ? (allRules || []).filter(r => selectedRuleIds.includes(r.id))
      : (allRules || []);

    if (activeRules.length === 0) {
      return res.status(200).json({ success: true, passed: true, feedback: 'No active AI QC rules found.' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel environment variables.' });
    }

    const rulesPrompt = activeRules
      .map((r, i) => `${i + 1}. [${r.blueprint} — ${r.area_name} — ${r.rule_title}]: ${r.rule_description}`)
      .join('\n');

    const parts = [
      {
        text: `You are a meticulous hospitality and facility quality control inspector. Inspect the SUBMITTED PHOTO for "${propertyName} - ${unitName}".

Standards to verify:
${rulesPrompt}

UNIVERSAL INSPECTION PROTOCOL:
1. WRONG AREA CHECK: Verify that the target area and objects described in the standard are actually visible in the submitted photo. If the photo shows an unrelated room or area, you MUST FAIL.
2. PERSPECTIVE VS. ACTUAL MISALIGNMENT: Cleaners shoot from different angles, heights, and distances—do NOT fail just because the camera angle or framing differs from the Golden Reference Photo. Instead, evaluate relative geometry in 3D space: compare every visible item against its immediate neighbors, counters/tables, and nearby wall or floor lines. If any individual item is visibly crooked, rotated out of parallel, pushed out of line with its row/group, or unevenly spaced relative to its neighbors, you MUST FAIL.
3. EXACT ITEM & ACCESSORY COUNTS: Inspect every single visible fixture or piece of furniture individually across the frame (front-to-back, left-to-right). Check exact item counts and pairings required by the standard—fail if any visible item has missing accessories, extra/doubled-up items, or off-center placement.
4. VISIBLE FRAME ONLY: Do not fail simply because outer edges of a room or additional items are cropped out of frame—strictly grade everything that IS visible inside the frame.
5. GOLDEN REFERENCE PHOTO: Use the Golden Reference Photo as the visual benchmark for exact staging, spacing, symmetry, and item pairing.
6. STEP-BY-STEP AUDIT FIRST: In "audit_notes", systematically scan the visible scene region-by-region (front-to-back, left-to-right), verifying item counts, accessory pairings, and relative alignment against neighbors/walls. Only set "passed": true if zero defects exist in the visible area.`
      }
    ];

    for (const rule of activeRules) {
      if (rule.reference_image_url && rule.reference_image_url.startsWith('http')) {
        try {
          const refPart = await urlToInlineData(rule.reference_image_url);
          parts.push({ text: `GOLDEN REFERENCE PHOTO for "${rule.area_name} — ${rule.rule_title}":` });
          parts.push(refPart);
        } catch (refErr) {
          console.warn('Skipping reference image:', refErr.message);
        }
      }
    }

    const submittedPart = await urlToInlineData(submittedImageUrl);
    parts.push({ text: 'SUBMITTED CLEANER PHOTO TO AUDIT:' });
    parts.push(submittedPart);

    const requestBody = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            audit_notes: { type: 'STRING' },
            passed: { type: 'BOOLEAN' },
            feedback: { type: 'STRING' }
          },
          required: ['audit_notes', 'passed', 'feedback']
        }
      }
    };

    const models = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];
    let geminiData = null;
    let lastErrorMsg = '';
    let lastStatus = 500;

    for (const model of models) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const apiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);

        const json = await apiRes.json();
        if (apiRes.ok) {
          geminiData = json;
          break;
        }
        lastStatus = apiRes.status;
        lastErrorMsg = json.error?.message || `Gemini ${model} failed (${apiRes.status})`;
      } catch (err) {
        lastErrorMsg = err.name === 'AbortError' ? `Gemini ${model} timed out.` : err.message;
      }
    }

    if (!geminiData) {
      return res.status(lastStatus === 429 ? 429 : 503).json({
        error: lastErrorMsg || 'AI inspection busy. Please retry.'
      });
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawText);

    return res.status(200).json({
      success: true,
      passed: Boolean(parsed.passed),
      feedback: parsed.feedback || (parsed.passed ? 'Meets all standards.' : 'Does not meet visual standards.')
    });
  } catch (err) {
    console.error('AI QC Check Error:', err);
    return res.status(500).json({ error: err.message });
  }
}