#!/usr/bin/env node
// Zara Webhook Test Runner
// Usage: node test.js [--scenario text-only|with-patient|with-image|all]

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const WEBHOOK_URL = process.env.ZARA_WEBHOOK_URL || 'https://ai.vashausmishka.com/webhook/Zara';
const IMAGE_PATH  = process.env.TEST_IMAGE_PATH   || null;

const arg      = process.argv.find(a => a.startsWith('--scenario=')) || '';
const scenario = arg ? arg.split('=')[1] : (process.argv[3] || 'all');

// ── Helpers ────────────────────────────────────────────────────────────────

function buildPatientBlock(name, phone, email) {
  return `[ДАНІ ПАЦІЄНТА]\nІм'я: ${name}\nТел: ${phone}\nEmail: ${email}`;
}

function loadImageAsBase64(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return buf.toString('base64');
}

async function sendToZara(payload, label) {
  const started = Date.now();
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`SCENARIO: ${label}`);
  console.log(`URL     : ${WEBHOOK_URL}`);
  console.log(`PAYLOAD : ${JSON.stringify({ ...payload, image: payload.image ? '[base64 ' + payload.image.length + ' chars]' : undefined }, null, 2)}`);
  console.log('Sending...');

  try {
    const res = await fetch(WEBHOOK_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload),
    });

    const elapsed = Date.now() - started;
    const text    = await res.text();

    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_) {}

    console.log(`STATUS  : ${res.status} ${res.statusText} (${elapsed}ms)`);

    if (!res.ok) {
      console.log(`ERROR   : ${text}`);
      return { ok: false, status: res.status, body: text };
    }

    if (parsed) {
      validateResponse(parsed, label);
    } else {
      console.log(`WARN    : Response is not JSON — "${text}"`);
    }

    return { ok: true, status: res.status, body: parsed ?? text };

  } catch (err) {
    console.log(`FETCH ERROR: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

function validateResponse(body, label) {
  const checks = [
    ['success field exists',             () => 'success' in body],
    ['success === true',                 () => body.success === true],
    ['design object present',            () => typeof body.design === 'object'],
    ['image_validation present',         () => typeof body.design?.image_validation === 'object'],
    ['patient_view present',             () => typeof body.design?.patient_view === 'object'],
    ['doctor_view present',              () => typeof body.design?.doctor_view === 'object'],
    ['title is a string',                () => typeof body.design?.patient_view?.title === 'string'],
    ['summary is a string',              () => typeof body.design?.patient_view?.summary === 'string'],
    ['recommended_services is array',    () => Array.isArray(body.design?.patient_view?.recommended_services)],
    ['estimated_price_range present',    () => !!body.design?.patient_view?.estimated_price_range],
    ['price_link.url present',           () => !!body.design?.patient_view?.price_link?.url],
    ['recommended_specialists is array', () => Array.isArray(body.design?.doctor_view?.recommended_specialists)],
    ['treatment_duration present',       () => !!body.design?.doctor_view?.treatment_duration],
    ['design_style is valid',            () => ['HOLLYWOOD', 'NATURAL', 'CORPORATE', 'YOUTHFUL'].includes(body.design?.design_style)],
    ['overall_score 1-10',               () => { const s = body.design?.current_smile_assessment?.overall_score; return typeof s === 'number' && s >= 1 && s <= 10; }],
  ];

  let passed = 0, failed = 0;
  const failures = [];

  for (const [name, fn] of checks) {
    let ok = false;
    try { ok = fn(); } catch (_) {}
    if (ok) { passed++; } else { failed++; failures.push(name); }
  }

  console.log(`\nVALIDATION [${label}]: ${passed}/${checks.length} passed`);
  if (failures.length) {
    failures.forEach(f => console.log(`  FAIL: ${f}`));
  }

  // Extra info
  const pv = body.design?.patient_view;
  const dv = body.design?.doctor_view;
  if (pv) {
    console.log(`  title    : ${pv.title}`);
    console.log(`  style    : ${body.design?.design_style}`);
    console.log(`  score    : ${body.design?.current_smile_assessment?.overall_score}/10`);
    console.log(`  services : ${(pv.recommended_services || []).join(', ')}`);
    console.log(`  price    : ${pv.estimated_price_range}`);
    console.log(`  doctors  : ${(dv?.recommended_specialists || []).join(', ')}`);
    console.log(`  duration : ${dv?.treatment_duration}`);
    console.log(`  gen img  : ${body.generated_image_base64 ? 'YES (' + body.generated_image_base64.length + ' chars)' : 'NO'}`);
  }

  return { passed, failed };
}

// ── Scenarios ──────────────────────────────────────────────────────────────

const scenarios = {

  'text-only': async () =>
    sendToZara(
      { message: 'Хочу красиву посмішку, зуби жовтуваті та трохи криві' },
      'Text-only (no image, no patient data)'
    ),

  'with-patient': async () =>
    sendToZara(
      {
        message: [
          'Хочу голлівудську посмішку, є кілька щербин та потемніння',
          buildPatientBlock('Іванна Коваль', '+380991234567', 'ivanna@gmail.com'),
        ].join('\n'),
      },
      'Text + patient data block'
    ),

  'with-image': async () => {
    const image = loadImageAsBase64(IMAGE_PATH);
    if (!image) {
      console.log('\nSKIP: with-image — no TEST_IMAGE_PATH set in .env');
      console.log('      Copy a JPEG to ./samples/test-smile.jpg and set TEST_IMAGE_PATH=./samples/test-smile.jpg');
      return { ok: false, skipped: true };
    }
    return sendToZara(
      {
        message: [
          'Хочу відбілення та вирівнювання',
          buildPatientBlock('Олена Мельник', '+380671234567', 'olena@gmail.com'),
        ].join('\n'),
        image,
      },
      'Text + patient data + image'
    );
  },

  'invalid-image': async () =>
    sendToZara(
      {
        message: 'Тест з некоректним зображенням',
        image  : 'bm90YW5pbWFnZQ==', // "notanimage" in base64
      },
      'Invalid base64 image (should return is_valid: false)'
    ),
};

// ── Runner ─────────────────────────────────────────────────────────────────

async function run() {
  console.log('ZARA WEBHOOK TEST RUNNER');
  console.log(`Endpoint: ${WEBHOOK_URL}`);
  console.log(`Scenario: ${scenario}`);

  const toRun = scenario === 'all'
    ? Object.keys(scenarios)
    : [scenario];

  const missing = toRun.filter(s => !scenarios[s]);
  if (missing.length) {
    console.error(`Unknown scenario(s): ${missing.join(', ')}`);
    console.error('Available:', Object.keys(scenarios).join(', '));
    process.exit(1);
  }

  const results = [];
  for (const s of toRun) {
    results.push(await scenarios[s]());
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('SUMMARY');
  toRun.forEach((s, i) => {
    const r = results[i];
    const label = r?.skipped ? 'SKIP' : r?.ok ? 'OK  ' : 'FAIL';
    console.log(`  [${label}] ${s}`);
  });
}

run().catch(err => { console.error(err); process.exit(1); });
