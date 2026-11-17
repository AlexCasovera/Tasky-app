// api/ai-qc-check.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { submittedImageUrl, propertyName, unitName, selectedRuleIds } = req.body || {};
  if (!submittedImageUrl || !propertyName || !unitName) {
    return res.status(400).json({ error: 'Missing submittedImageUrl, propertyName, or unitName.' });
  }

  try {
    // 1. Look up the unit's assigned blueprint tags
    const { data: unitData, error: unitErr } = await supabase
      .from('property_units')
      .select('*')
      .eq('property_name', propertyName)
      .eq('unit_name', unitName)
      .single();

    if (unitErr || !unitData) {
      return res.status(200).json({
        success: true,
        passed: true,
        feedback: 'Unit blueprint not configured; auto-passed.'
      });
    }

    const unitBlueprints = Array.isArray(unitData.blueprints) && unitData.blueprints.length > 0
      ? unitData.blueprints
      : (unitData.blueprint ? [unitData.blueprint] : []);

    if (unitBlueprints.length === 0) {
      return res.status(200).json({
        success: true,
        passed: true,
        feedback: 'No blueprints assigned to this unit; auto-passed.'
      });
    }

    // 2. Fetch active rules matching ANY of the unit's blueprint tags
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
      return res.status(200).json({
        success: true,
        passed: true,
        feedback: 'No active AI QC rules found for this unit.'
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel environment variables.' });
    }

    // 3. Build multimodal parts with Golden Reference Photos + Submitted Photo
    const rulesPrompt = activeRules
      .map((r, i) => `${i + 1}. [${r.blueprint} — ${r.area_name} — ${r.rule_title}]: ${r.rule_description}`)
      .join('\n');

    const parts = [
      {
        text: `You are a strict hospitality and facility quality control inspector. Inspect the SUBMITTED PHOTO for "${propertyName} - ${unitName}" (Blueprints: ${unitBlueprints.join(', ')}).\n\nEvaluate ONLY the items visible in the submitted photo against these standards:\n${rulesPrompt}\n\nNote: A single photo may only show one area (e.g., just the Meeting Area OR just the Kitchen). Only fail the photo if an area shown in the photo violates its standard.`
      }
    ];

    for (const rule of activeRules) {
      if (rule.reference_image_url && rule.reference_image_url.startsWith('http')) {
        try {
          const refPart = await urlToInlineData(rule.reference_image_url);
          parts.push({ text: `GOLDEN REFERENCE PHOTO for "${rule.area_name} — ${rule.rule_title}":` });
          parts.push(refPart);
        } catch (refErr) {
          console.warn('Skipping unreadable reference image:', refErr.message);
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

    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    let geminiData = null;
    let lastErrorMsg = '';

    for (const model of models) {
      const apiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      const json = await apiRes.json();
      if (apiRes.ok) {
        geminiData = json;
        break;
      }
      lastErrorMsg = json.error?.message || `Gemini ${model} failed (${apiRes.status})`;
    }

    if (!geminiData) {
      throw new Error(lastErrorMsg || 'All free-tier Gemini models failed to respond.');
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