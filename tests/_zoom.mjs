import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 510, height: 480 } });
const data = fs.readFileSync(process.argv[2]).toString('base64');
await pg.setContent(`<body style="margin:0"><canvas id=c width=510 height=480></canvas><script>
const img=new Image();img.onload=()=>{const c=document.getElementById('c').getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(img,${process.argv[3]},${process.argv[4]},170,160,0,0,510,480);document.title='ok'};img.src='data:image/png;base64,${data}'</script>`);
await pg.waitForFunction(() => document.title === 'ok');
await pg.screenshot({ path: process.argv[5] });
await b.close();
