/**
 * generate-resume.js
 * ─────────────────────────────────────────────────────
 * Reads JSON Resume schema (resume.json) + resume-template.html
 * Handles:
 *   ✅ assets/resume/ folder missing  → creates it
 *   ✅ atheesh-alva-resume.pdf missing → creates new
 *   ✅ atheesh-alva-resume.pdf exists  → overwrites
 *   ✅ profile picture missing         → falls back to initials
 * ─────────────────────────────────────────────────────
 * Run locally:  node scripts/generate-resume.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ── Output path ───────────────────────────────────────────────────────────────
const OUTPUT_DIR = path.join('assets', 'resume');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'atheesh-alva-resume.pdf');

// ── Step 1: Ensure output directory exists ────────────────────────────────────
console.log('\n📁 Checking output directory...');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`   Created: ${OUTPUT_DIR}`);
} else {
  console.log(`   Found:   ${OUTPUT_DIR}`);
}

// ── Step 2: Load resume data (JSON Resume schema) ─────────────────────────────
console.log('\n📄 Loading resume data...');
if (!fs.existsSync('resume.json')) {
  console.error('   ❌ resume.json not found in project root.');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync('resume.json', 'utf8'));

// Destructure from JSON Resume schema paths
const { basics, meta = {}, work = [], education = [] } = data;

console.log(`   Loaded data for: ${basics.name}`);

// ── Step 3: Load HTML template ────────────────────────────────────────────────
console.log('\n🎨 Loading HTML template...');
if (!fs.existsSync('resume-template.html')) {
  console.error('   ❌ resume-template.html not found in project root.');
  process.exit(1);
}
let html = fs.readFileSync('resume-template.html', 'utf8');
console.log('   Template loaded.');

// ── Step 4: Handle profile picture ───────────────────────────────────────────
console.log('\n🖼️  Looking for profile picture...');
const picFormats = ['jpg', 'jpeg', 'png', 'webp'];
const foundPic = picFormats
  .map(ext => path.join('assets', `profile.${ext}`))
  .find(p => fs.existsSync(p));

let profilePicHtml = '';
if (foundPic) {
  const ext = path.extname(foundPic).slice(1).replace('jpg', 'jpeg');
  const b64 = fs.readFileSync(foundPic).toString('base64');
  profilePicHtml = `<img src="data:image/${ext};base64,${b64}" alt="Profile photo of ${basics.name}" />`;
  console.log(`   Found: ${foundPic}`);
} else {
  const initials = (basics.name || 'AA')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('');
  profilePicHtml = `<div class="profile-initials">${initials}</div>`;
  console.log('   Not found — using initials as fallback.');
  console.log('   Tip: Place your photo at assets/profile.jpg to include it.');
}

// ── Step 5: Compute derived values ───────────────────────────────────────────
console.log('\n🔧 Injecting data into template...');

// Build location string from structured basics.location object
const loc = basics.location || {};
const locationStr = [loc.city, loc.region, loc.countryCode].filter(Boolean).join(', ');

// Get a social profile URL by network name
const getProfile = (network) =>
  (basics.profiles || [])
    .find(p => p.network.toLowerCase() === network.toLowerCase())
    ?.url?.replace('https://', '') || '';

// Derive years of experience from meta.careerStartDate (YYYY-MM)
// Anniversary month tips to the next full year:
//   start = Sept 2019 (month 9)
//   today = Aug 2026  → month 8 < 9  → 2026 - 2019 - 1 = 6 → "6+"
//   today = Sept 2026 → month 9 ≥ 9  → 2026 - 2019     = 7 → "7+"
let yearsOfExp = '6'; // static fallback
if (meta.careerStartDate) {
  const [startY, startM] = meta.careerStartDate.split('-').map(Number);
  const now = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1; // 1-indexed
  const completed = nowM >= startM ? nowY - startY : nowY - startY - 1;
  yearsOfExp = `${completed}`;
}

// Compute automation savings: 100 * totalReduction / totalInitial
// Add as many tasks as needed in meta.automationTasks in resume.json
let automationTimeSaved = '';
if (meta.automationTasks && meta.automationTasks.length > 0) {
  const totalInitial = meta.automationTasks.reduce((s, t) => s + t.beforeMin, 0);
  const totalAfter = meta.automationTasks.reduce((s, t) => s + t.afterMin, 0);
  const totalReduction = totalInitial - totalAfter;
  const pct = Math.round(100 * totalReduction / totalInitial);
  automationTimeSaved = `${pct}%`;
  console.log(`   Automation tasks : ${meta.automationTasks.length}`);
  console.log(`   Before           : ${totalInitial} min`);
  console.log(`   After            : ${totalAfter} min`);
  console.log(`   Saved            : ${totalReduction} min → ${automationTimeSaved}`);
}

// Compute latency reduction: 100 * totalReduction / totalInitial (same formula as automation)
// Add more entries to meta.latencyProjects in resume.json to include them
let latencyReduction = '';
if (meta.latencyProjects && meta.latencyProjects.length > 0) {
  const totalBefore = meta.latencyProjects.reduce((s, p) => s + p.beforeMs, 0);
  const totalAfter = meta.latencyProjects.reduce((s, p) => s + p.afterMs, 0);
  const totalReduction = totalBefore - totalAfter;
  const pct = Math.round(100 * totalReduction / totalBefore);
  latencyReduction = `${pct}%`;
  console.log(`   Latency projects : ${meta.latencyProjects.length}`);
  meta.latencyProjects.forEach(p =>
    console.log(`     ${p.label.padEnd(35)} ${p.beforeMs}ms → ${p.afterMs}ms`)
  );
  console.log(`   Aggregate reduction : ${latencyReduction}`);
}

// Strip non-digit chars for tel: href  e.g. "+91 98765 43210" → "+919876543210"
const phoneRaw = (basics.phone || '').replace(/[^\d+]/g, '');

// ── Step 6: Build replacements map and inject into template ──────────────────
const replacements = {
  NAME: basics.name,
  TITLE: basics.label,
  EMAIL: basics.email,
  PHONE: basics.phone,
  PHONE_RAW: phoneRaw,
  LOCATION: locationStr,
  GITHUB: getProfile('github'),
  LINKEDIN: getProfile('linkedin'),
  PORTFOLIO: (basics.url || '').replace('https://', ''),
  YEARS: yearsOfExp,
  AUTOMATION_TIME_SAVED: automationTimeSaved,
  LATENCY_REDUCTION: latencyReduction,
  SYSTEMS_AUDITED: meta.systemsAudited || '',
  COMPANY1: work[0]?.name || '',
  COMPANY2: work[1]?.name || '',
  UNIVERSITY: education[0]?.institution || '',
  PROFILE_PIC: profilePicHtml,
};

for (const [key, value] of Object.entries(replacements)) {
  html = html.replaceAll(`{{${key}}}`, value ?? '');
}
console.log(`   Replaced ${Object.keys(replacements).length} placeholders.`);

// ── Step 7: Check if PDF already exists ──────────────────────────────────────
const isUpdate = fs.existsSync(OUTPUT_FILE);
console.log(`\n📋 PDF status: ${isUpdate ? 'EXISTS — will overwrite' : 'NOT FOUND — will create new'}`);

// ── Step 8: Generate PDF via headless Chromium ───────────────────────────────
console.log('\n🚀 Launching headless browser...');
(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Wait for Google Fonts to finish loading (avoids fallback font in PDF)
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluateHandle('document.fonts.ready');

    await page.pdf({
      path: OUTPUT_FILE,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,  // respects @page / @page :first margins in CSS
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    console.log('\n✅ Done!');
    console.log(`   Action : ${isUpdate ? 'Updated' : 'Created'}`);
    console.log(`   Output : ${OUTPUT_FILE}`);
    const size = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1);
    console.log(`   Size   : ${size} KB\n`);

  } catch (err) {
    console.error('\n❌ PDF generation failed:');
    console.error(err.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();