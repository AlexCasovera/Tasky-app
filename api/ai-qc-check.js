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
        text: `You are a practical, fair hospitality and facility quality control inspector. Inspect the SUBMITTED PHOTO for "${propertyName} - ${unitName}".

Standards to verify:
${rulesPrompt}

CRITICAL GRADING GUIDELINES (READ CAREFULLY):
1. CAMERA ANGLE & PERSPECTIVE INVARIANCE: Cleaners take photos from different corners, heights, and angles than the Golden Reference Photo. Do NOT fail a photo simply because it was taken from a side angle, closer up, or rotated relative to the reference photo. Mentally reconstruct the 3D room layout from the cleaner's camera angle.
2. GRADE ONLY WHAT IS VISIBLE (CROPPED PHOTOS ARE OK): Cleaners often capture only part of a room or cut off outer furniture at the edge of the frame. NEVER fail a photo because some benches, stools, or items are cropped out of frame. Only evaluate the items actually visible in the submitted photo.
3. HOW TO USE THE GOLDEN REFERENCE PHOTO: Use the Golden Reference Photo solely as a visual guide to understand what the furniture and staging look like when done properly (e.g., how a bolster pillow sits on a bench or how stools tuck under a counter). Do not require identical framing or item counts.
4. WHEN TO FAIL:
   - Fail if the submitted photo shows a completely wrong area/room unrelated to the standard (e.g., showing kitchen stools when asked for meeting benches).
   - Fail if the visible items clearly violate the standard (e.g., benches visibly crooked/scattered, bolster pillows missing from visible benches, multiple pillows stacked on one bench, or stools pulled out/askew).
5. Return valid JSON only: {"passed": boolean, "feedback": "concise, specific explanation of what you see in the visible area"}`
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
            passed: { type: 'BOOLEAN' },
            feedback: { type: 'STRING' }
          },
          required: ['passed', 'feedback']
        }
      }
    };

    // Rotate across 3 separate model quota pools so back-to-back uploads succeed immediately
    const models = ['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.8-flash'];
    let geminiData = null;
    let lastErrorMsg = '';
    let lastStatus = 500;

    for (const model of models) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

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