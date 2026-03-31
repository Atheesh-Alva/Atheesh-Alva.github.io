/**
 * generate-resume.js
 * All content comes from resume.json.
 * This file handles structure, logic, and PDF generation only.
 *
 * Run locally: node scripts/generate-resume.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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

// ── Step 2: Load data and template ───────────────────────────────────────────
console.log('\n📄 Loading resume data...');
if (!fs.existsSync('resume.json')) { console.error('   ❌ resume.json not found.'); process.exit(1); }
if (!fs.existsSync('resume-template.html')) { console.error('   ❌ resume-template.html not found.'); process.exit(1); }

const data = JSON.parse(fs.readFileSync('resume.json', 'utf8'));
let html = fs.readFileSync('resume-template.html', 'utf8');

const { basics, meta = {}, work = [], education = [], certificates = [],
  skills = [], languages = [], interests = [], projects = [], awards = [] } = data;

console.log(`   Loaded data for: ${basics.name}`);

// ── Step 3: Profile picture ───────────────────────────────────────────────────
console.log('\n🖼️  Looking for profile picture...');
const foundPic = ['jpg', 'jpeg', 'png', 'webp']
  .map(ext => path.join('assets', `profile.${ext}`))
  .find(p => fs.existsSync(p));

let profilePicHtml = '';
if (foundPic) {
  const ext = path.extname(foundPic).slice(1).replace('jpg', 'jpeg');
  const b64 = fs.readFileSync(foundPic).toString('base64');
  profilePicHtml = `<img src="data:image/${ext};base64,${b64}" alt="Profile photo of ${basics.name}" />`;
  console.log(`   Found: ${foundPic}`);
} else {
  const initials = (basics.name || 'AA').split(' ').map(n => n[0]).slice(0, 2).join('');
  profilePicHtml = `<div class="profile-initials">${initials}</div>`;
  console.log('   Not found — using initials. Place photo at assets/profile.jpg to include it.');
}

// ── Step 4: Computed metrics ──────────────────────────────────────────────────
console.log('\n📊 Computing metrics...');

// Years of experience — month-accurate
let yearsOfExp = '6';
if (meta.careerStartDate) {
  const [startY, startM] = meta.careerStartDate.split('-').map(Number);
  const now = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;
  yearsOfExp = `${nowM >= startM ? nowY - startY : nowY - startY - 1}`;
}
console.log(`   Years of experience : ${yearsOfExp}+`);

// Automation time saved: 100 * totalReduction / totalInitial
let automationTimeSaved = '';
if (meta.automationTasks?.length > 0) {
  const totalBefore = meta.automationTasks.reduce((s, t) => s + t.beforeMin, 0);
  const totalAfter = meta.automationTasks.reduce((s, t) => s + t.afterMin, 0);
  automationTimeSaved = `${Math.round(100 * (totalBefore - totalAfter) / totalBefore)}%`;
  console.log(`   Automation saved    : ${automationTimeSaved} (${meta.automationTasks.length} tasks)`);
}

// Latency reduction: 100 * totalReduction / totalInitial
let latencyReduction = '';
if (meta.latencyProjects?.length > 0) {
  const totalBefore = meta.latencyProjects.reduce((s, p) => s + p.beforeMs, 0);
  const totalAfter = meta.latencyProjects.reduce((s, p) => s + p.afterMs, 0);
  latencyReduction = `${Math.round(100 * (totalBefore - totalAfter) / totalBefore)}%`;
  console.log(`   Latency reduction   : ${latencyReduction} (${meta.latencyProjects.length} projects)`);
}

// ── Step 5: HTML generators ───────────────────────────────────────────────────
console.log('\n🔧 Generating HTML sections...');

// Helper — format "2023-01" → "January 2023", missing endDate → "Present"
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (d) => {
  if (!d) return 'Present';
  const [y, m] = d.split('-');
  return m ? `${MONTHS[parseInt(m, 10) - 1]} ${y}` : y;
};

// Award icon SVG paths keyed by icon name in resume.json
const ICONS = {
  trophy: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zm-14 3V7h2v3.82C5.84 10.4 5 9.3 5 8zm7 6c-1.65 0-3-1.35-3-3V5h6v6c0 1.65-1.35 3-3 3zm7-6c0 1.3-.84 2.4-2 2.82V7h2v1z',
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  article: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
};
const checkSvg = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

// Work experience
const WORK_HTML = work.map(job => {
  const dateRange = `${fmtDate(job.startDate)} – ${fmtDate(job.endDate)}`;
  const meta2 = [job.employmentType, job.location].filter(Boolean).join(' · ');
  const bullets = (job.highlights || []).map(b => `<li>${b}</li>`).join('');
  const chips = (job.keywords || []).map(k => `<span class="chip">${k}</span>`).join('');
  return `
    <div class="exp-item">
      <div class="exp-header">
        <div class="exp-role">${job.position}</div>
        <div class="exp-date">${dateRange}</div>
      </div>
      <div class="exp-company">${job.name}${meta2 ? ` <em>· ${meta2}</em>` : ''}</div>
      <ul class="exp-bullets">${bullets}</ul>
      ${chips ? `<div class="tech-chips">${chips}</div>` : ''}
    </div>`;
}).join('');

// Projects
const PROJECTS_HTML = projects.map(p => {
  const stack = (p.keywords || []).join(' · ');
  return `
    <div class="project-item">
      <div class="project-row">
        <div class="project-name">${p.name}</div>
        ${stack ? `<div class="project-stack">${stack}</div>` : ''}
      </div>
      <div class="project-desc">${p.description || ''}</div>
    </div>`;
}).join('');

// Education
const EDUCATION_HTML = education.map(e => {
  const degree = `${e.studyType} – ${e.area}`;
  const years = `${fmtDate(e.startDate).split(' ').pop()} – ${fmtDate(e.endDate).split(' ').pop()}`;
  const school = [e.institution, e.score ? `GPA: ${e.score}` : ''].filter(Boolean).join(' · ');
  return `
    <div class="edu-item">
      <div>
        <div class="edu-degree">${degree}</div>
        <div class="edu-school">${school}</div>
      </div>
      <div class="edu-date">${years}</div>
    </div>`;
}).join('');

// Achievements / awards
const ACHIEVEMENTS_HTML = awards.map(a => {
  const iconPath = ICONS[a.icon] || ICONS.star;
  return `
    <div class="achievement-item">
      <div class="ach-icon"><svg viewBox="0 0 24 24"><path d="${iconPath}"/></svg></div>
      <div class="achievement-text"><strong>${a.title}.</strong> ${a.summary}</div>
    </div>`;
}).join('');

// Skills (grouped with bars)
const SKILLS_HTML = skills.map(group => {
  const rows = (group.items || []).map(s => `
      <div class="skill-row">
        <div class="skill-top">
          <span class="skill-name">${s.name}</span>
          <span class="skill-level">${s.level}</span>
        </div>
        <div class="skill-bar"><div class="skill-bar-fill" style="width:${s.pct}%"></div></div>
      </div>`).join('');
  return `
    <div class="skill-group">
      <div class="skill-group-name">${group.name}</div>
      ${rows}
    </div>`;
}).join('');

// Certifications
const CERTIFICATIONS_HTML = certificates.map(c => {
  const year = c.date ? c.date.substring(0, 4) : '';
  return `
    <div class="cert-item">
      <div class="cert-check">${checkSvg}</div>
      <div>
        <div class="cert-name">${c.name}</div>
        <div class="cert-meta">${[c.issuer, year].filter(Boolean).join(' · ')}</div>
      </div>
    </div>`;
}).join('');

// Languages (pip dots — max 5)
const LANGUAGES_HTML = languages.map(l => {
  const filled = Math.min(Math.max(l.pips || 0, 0), 5);
  const pips = Array.from({ length: 5 }, (_, i) =>
    `<div class="pip ${i < filled ? 'on' : 'off'}"></div>`).join('');
  return `
    <div class="lang-item">
      <div class="lang-top">
        <span class="lang-name">${l.language}</span>
        <span class="lang-level-label">${l.fluency}</span>
      </div>
      <div class="lang-pips">${pips}</div>
    </div>`;
}).join('');

// Tools
const TOOLS_HTML = `<div class="tools-wrap">${(meta.tools || []).map(t => `<span class="tool-tag">${t}</span>`).join('')
  }</div>`;

// Interests
const INTERESTS_HTML = `<div class="tools-wrap">${interests.map(i => `<span class="tool-tag">${i.name}</span>`).join('')
  }</div>`;

// ── Step 6: Build replacements and inject ─────────────────────────────────────
const loc = basics.location || {};
const getProf = (n) => (basics.profiles || [])
  .find(p => p.network.toLowerCase() === n.toLowerCase())
  ?.url?.replace('https://', '') || '';
const phoneRaw = (basics.phone || '').replace(/[^\d+]/g, '');

const replacements = {
  NAME: basics.name,
  TITLE: basics.label,
  SUMMARY: basics.summary,
  EMAIL: basics.email,
  PHONE: basics.phone,
  PHONE_RAW: phoneRaw,
  LOCATION: [loc.city, loc.region, loc.countryCode].filter(Boolean).join(', '),
  GITHUB: getProf('github'),
  LINKEDIN: getProf('linkedin'),
  PORTFOLIO: (basics.url || '').replace('https://', ''),
  YEARS: yearsOfExp,
  AUTOMATION_TIME_SAVED: automationTimeSaved,
  LATENCY_REDUCTION: latencyReduction,
  SYSTEMS_AUDITED: meta.systemsAudited || '',
  WORK_HTML,
  PROJECTS_HTML,
  EDUCATION_HTML,
  ACHIEVEMENTS_HTML,
  SKILLS_HTML,
  CERTIFICATIONS_HTML,
  LANGUAGES_HTML,
  TOOLS_HTML,
  INTERESTS_HTML,
  PROFILE_PIC: profilePicHtml,
};

for (const [key, value] of Object.entries(replacements)) {
  html = html.replaceAll(`{{${key}}}`, value ?? '');
}
console.log(`   Replaced ${Object.keys(replacements).length} placeholders.`);

// ── Step 7: Check if PDF already exists ──────────────────────────────────────
const isUpdate = fs.existsSync(OUTPUT_FILE);
console.log(`\n📋 PDF status: ${isUpdate ? 'EXISTS — will overwrite' : 'NOT FOUND — will create new'}`);

// ── Step 8: Generate PDF ──────────────────────────────────────────────────────
console.log('\n🚀 Launching headless browser...');
(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluateHandle('document.fonts.ready');
    await page.pdf({
      path: OUTPUT_FILE,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    console.log(`\n✅ ${isUpdate ? 'Updated' : 'Created'}: ${OUTPUT_FILE}`);
    console.log(`   Size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB\n`);
  } catch (err) {
    console.error('\n❌ PDF generation failed:', err.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();