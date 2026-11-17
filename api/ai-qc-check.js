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
        text: `You are a strict hospitality quality control inspector. Inspect the SUBMITTED PHOTO for "${propertyName} - ${unitName}".\n\nStandards:\n${rulesPrompt}\n\nSTRICT RULES:\n1. Verify items in the standard are visible.\n2. If the cleaner uploads the wrong area, FAIL the inspection.\n3. Return valid JSON only: {"passed": boolean, "feedback": "concise explanation"}`
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

    // Use gemini-3.5-flash-lite first for lightning-fast responses, falling back to 3.8-flash
    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
    let geminiData = null;
    let lastErrorMsg = '';

    for (const model of models) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second hard timeout

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
        lastErrorMsg = json.error?.message || `Gemini ${model} failed (${apiRes.status})`;
      } catch (err) {
        lastErrorMsg = err.name === 'AbortError' ? `Gemini ${model} timed out.` : err.message;
      }
    }

    if (!geminiData) {
      throw new Error(lastErrorMsg || 'AI inspection timed out due to high server load. Please try again.');
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