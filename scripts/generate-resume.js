const puppeteer = require('puppeteer');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

// Step A: Read your resume text file
const markdown = fs.readFileSync('resume.md', 'utf8');

// Step B: Wrap it in a pretty HTML page with styling
const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      max-width: 780px;
      margin: 0 auto;
      padding: 40px 50px;
      font-size: 13px;
      line-height: 1.6;
      color: #222;
    }
    h1 { font-size: 26px; margin-bottom: 2px; }
    h2 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      border-bottom: 1.5px solid #333;
      padding-bottom: 3px;
      margin-top: 22px;
    }
    h3 { font-size: 13px; margin: 10px 0 2px; }
    ul { margin: 4px 0; padding-left: 18px; }
    li { margin-bottom: 2px; }
    a  { color: #222; text-decoration: none; }
    p  { margin: 4px 0; }
  </style>
</head>
<body>${marked(markdown)}</body>
</html>`;

// Step C: Open a hidden browser, load the page, save as PDF
(async () => {
  // Make sure the output folder exists
  fs.mkdirSync(path.join('assets', 'resume'), { recursive: true });

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: path.join('assets', 'resume', 'myresume.pdf'),  // saves to your exact path
    format: 'A4',
    margin: { top: '18mm', bottom: '18mm', left: '12mm', right: '12mm' },
    printBackground: true,
  });
  await browser.close();
  console.log('✅ myresume.pdf generated successfully!');
})();
