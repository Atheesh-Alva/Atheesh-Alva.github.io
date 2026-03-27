const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const data = JSON.parse(fs.readFileSync('resume.json', 'utf8'));
let html   = fs.readFileSync('resume-template.html', 'utf8');

// Profile picture — auto-detect jpg / png / webp
const picFormats = ['jpg', 'jpeg', 'png', 'webp'];
const foundPic   = picFormats
  .map(ext => path.join('assets', `profile.${ext}`))
  .find(p => fs.existsSync(p));

let profilePicHtml = '';
if (foundPic) {
  const ext      = path.extname(foundPic).slice(1).replace('jpg', 'jpeg');
  const b64      = fs.readFileSync(foundPic).toString('base64');
  profilePicHtml = `<img src="data:image/${ext};base64,${b64}" alt="Profile photo of ${data.name}" />`;
  console.log(`Profile picture loaded: ${foundPic}`);
} else {
  const initials = data.name.split(' ').map(n => n[0]).slice(0,2).join('');
  profilePicHtml = `<div class="profile-initials">${initials}</div>`;
  console.log('No profile photo found — using initials. Place photo at: assets/profile.jpg');
}

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

(async () => {
  const outDir = path.join('assets', 'resume');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page    = await browser.newPage();

  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

  await page.pdf({
    path:            path.join(outDir, 'myresume.pdf'),
    format:          'A4',
    printBackground: true,
    margin:          { top: 0, bottom: 0, left: 0, right: 0 },
  });

  await browser.close();
  console.log('PDF saved → assets/resume/myresume.pdf');
})();
