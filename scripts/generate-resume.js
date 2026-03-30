/**
 * generate-resume.js
 * ─────────────────────────────────────────────────────
 * Handles:
 *   ✅ assets/resume/ folder missing  → creates it
 *   ✅ atheesh-alva-resume.pdf missing → creates it
 *   ✅ atheesh-alva-resume.pdf exists  → overwrites it
 *   ✅ profile picture missing         → falls back to initials
 * ─────────────────────────────────────────────────────
 * Run locally:  node scripts/generate-resume.js
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

// ── Output path ───────────────────────────────────────────────────────────────
const OUTPUT_DIR  = path.join('assets', 'resume');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'atheesh-alva-resume.pdf');

// ── Step 1: Ensure output directory exists ────────────────────────────────────
console.log('\n📁 Checking output directory...');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`   Created: ${OUTPUT_DIR}`);
} else {
  console.log(`   Found:   ${OUTPUT_DIR}`);
}

// ── Step 2: Load resume data ──────────────────────────────────────────────────
console.log('\n📄 Loading resume data...');
if (!fs.existsSync('resume.json')) {
  console.error('   ❌ resume.json not found in project root.');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync('resume.json', 'utf8'));
console.log(`   Loaded data for: ${data.name}`);

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
const foundPic   = picFormats
  .map(ext => path.join('assets', `profile.${ext}`))
  .find(p => fs.existsSync(p));

let profilePicHtml = '';
if (foundPic) {
  const ext      = path.extname(foundPic).slice(1).replace('jpg', 'jpeg');
  const b64      = fs.readFileSync(foundPic).toString('base64');
  profilePicHtml = `<img src="data:image/${ext};base64,${b64}" alt="Profile photo of ${data.name}" />`;
  console.log(`   Found: ${foundPic}`);
} else {
  const initials = (data.name || 'AA')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('');
  profilePicHtml = `<div class="profile-initials">${initials}</div>`;
  console.log('   Not found — using initials as fallback.');
  console.log('   Tip: Place your photo at assets/profile.jpg to include it.');
}

// ── Step 5: Inject data into template ────────────────────────────────────────
console.log('\n🔧 Injecting data into template...');
const replacements = {
  NAME:        data.name,
  TITLE:       data.title,
  EMAIL:       data.contact.email,
  PHONE:       data.contact.phone,
  LOCATION:    data.contact.location,
  GITHUB:      data.contact.github,
  LINKEDIN:    data.contact.linkedin,
  PORTFOLIO:   data.contact.portfolio,
  YEARS:       data.yearsOfExperience,
  APP_COUNT:   data.appCount,
  USER_COUNT:  data.userCount,
  API_COUNT:   data.apiCount,
  COMPANY1:    data.experience[0]?.company || '',
  COMPANY2:    data.experience[1]?.company || '',
  UNIVERSITY:  data.education[0]?.school   || '',
  PROFILE_PIC: profilePicHtml,
};

for (const [key, value] of Object.entries(replacements)) {
  html = html.replaceAll(`{{${key}}}`, value ?? '');
}
console.log(`   Replaced ${Object.keys(replacements).length} placeholders.`);

// ── Step 6: Check if PDF already exists ──────────────────────────────────────
const isUpdate = fs.existsSync(OUTPUT_FILE);
console.log(`\n📋 PDF status: ${isUpdate ? 'EXISTS — will overwrite' : 'NOT FOUND — will create new'}`);

// ── Step 7: Generate PDF via headless Chromium ───────────────────────────────
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

    // Load HTML — wait for fonts (Google Fonts) to finish loading
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // Extra wait to ensure web fonts have rendered (avoids fallback font in PDF)
    await page.evaluateHandle('document.fonts.ready');

    await page.pdf({
      path:            OUTPUT_FILE,
      format:          'A4',
      printBackground: true,
      margin:          { top: 0, bottom: 0, left: 0, right: 0 },
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
