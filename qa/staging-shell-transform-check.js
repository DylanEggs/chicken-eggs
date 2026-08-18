const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const shell=fs.readFileSync(path.join(root,'app-shell-v1.html'),'utf8');
const build=JSON.parse(fs.readFileSync(path.join(root,'app-build.json'),'utf8')).build;

function replaceAsset(html,file,oldQuery,build){
  return html.split(`${file}?${oldQuery}`).join(`${file}?v=${build}`);
}

let html=shell;
html=html.replace('<head>','<head><base href="../"><meta name="robots" content="noindex,nofollow"><script src="staging/staging-storage.js"></script>');
html=replaceAsset(html,'style.css','v=100',build);
html=replaceAsset(html,'app2.css','v=1',build);
html=replaceAsset(html,'firebase.js','v=6',build);
html=replaceAsset(html,'database.js','v=6',build);
html=replaceAsset(html,'script.js','v=221',build);
html=replaceAsset(html,'app2.js','v=1',build);
html=replaceAsset(html,'inventory.js','v=1',build);
html=replaceAsset(html,'inventory-ui.js','v=1',build);
html=replaceAsset(html,'extras-dashboard.js','v=1',build);
html=replaceAsset(html,'extras-fun.js','v=1',build);
html=html.replace(`type="module" src="firebase.js?v=${build}"`,`type="module" src="staging/staging-firebase.js?v=${build}"`);
html=html.replace(`src="database.js?v=${build}"`,`src="staging/staging-database.js?v=${build}"`);
html=html.replace(`src="app2.js?v=${build}"`,`src="staging/staging-app2.js?v=${build}"`);

const failures=[];
const check=(name,ok)=>{if(!ok)failures.push(name);else console.log('PASS ',name);};
check('Live firebase entrypoint removed from generated staging shell',!html.includes(`type="module" src="firebase.js?v=${build}"`));
check('Live database adapter removed from generated staging shell',!html.includes(`src="database.js?v=${build}"`));
check('Live app2 loader removed from generated staging shell',!html.includes(`src="app2.js?v=${build}"`));
check('Staging Firebase adapter present',html.includes(`type="module" src="staging/staging-firebase.js?v=${build}"`));
check('Staging database adapter present',html.includes(`src="staging/staging-database.js?v=${build}"`));
check('Staging app2 adapter present',html.includes(`src="staging/staging-app2.js?v=${build}"`));
check('Staging storage loads before shell application code',html.indexOf('staging/staging-storage.js') < html.indexOf('staging/staging-firebase.js'));
check('Normal core script still uses current live code build',html.includes(`script.js?v=${build}`));
check('Normal inventory compatibility shell remains current build',html.includes(`inventory.js?v=${build}`));
check('Normal dashboard extras remain current build',html.includes(`extras-dashboard.js?v=${build}`));

if(failures.length){
  console.error('\nSTAGING SHELL TRANSFORM FAILURES:');
  failures.forEach(x=>console.error('FAIL ',x));
  process.exit(1);
}
console.log(`\nPASS Staging shell transform — ${build}; live cloud entrypoints cannot survive generated shell`);
