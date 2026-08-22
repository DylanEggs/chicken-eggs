const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const shell=fs.readFileSync(path.join(root,'app-shell-v1.html'),'utf8');
const build=JSON.parse(fs.readFileSync(path.join(root,'app-build.json'),'utf8')).build;
const stageBuild=JSON.parse(fs.readFileSync(path.join(root,'staging/staging-build.json'),'utf8')).build;

function replaceAsset(html,file,oldQuery,build){return html.split(`${file}?${oldQuery}`).join(`${file}?v=${build}`);}
const stageAsset=path=>`${path}?stage=${encodeURIComponent(stageBuild)}&app=${encodeURIComponent(build)}`;

let html=shell;
html=html.replace('<head>',`<head><base href="../"><meta name="robots" content="noindex,nofollow"><script src="${stageAsset('staging/staging-local-seed-v1.js')}"></script><script src="${stageAsset('staging/staging-storage.js')}"></script>`);
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
html=html.replace(`type="module" src="firebase.js?v=${build}"`,`type="module" src="${stageAsset('staging/staging-firebase.js')}"`);
html=html.replace(`src="database.js?v=${build}"`,`src="${stageAsset('staging/staging-database.js')}"`);
html=html.replace(`src="app2.js?v=${build}"`,`src="${stageAsset('staging/staging-app2.js')}"`);
html=html.replace(`src="extras-fun.js?v=${build}"`,`src="${stageAsset('staging/staging-extras-fun.js')}"`);

const failures=[];
const check=(name,ok)=>{if(!ok)failures.push(name);else console.log('PASS ',name);};
check('Live firebase entrypoint removed from generated staging shell',!html.includes(`type="module" src="firebase.js?v=${build}"`));
check('Live database adapter removed from generated staging shell',!html.includes(`src="database.js?v=${build}"`));
check('Live app2 loader removed from generated staging shell',!html.includes(`src="app2.js?v=${build}"`));
check('Live fun loader removed from generated staging shell',!html.includes(`src="extras-fun.js?v=${build}"`));
check('Staging Firebase adapter present with staging build cache key',html.includes(stageAsset('staging/staging-firebase.js')));
check('Staging database adapter present with staging build cache key',html.includes(stageAsset('staging/staging-database.js')));
check('Staging app2 adapter present with staging build cache key',html.includes(stageAsset('staging/staging-app2.js')));
check('Guarded staging fun adapter present with staging build cache key',html.includes(stageAsset('staging/staging-extras-fun.js')));
check('LIVE browser mirror has staging-specific cache key',html.includes(stageAsset('staging/staging-local-seed-v1.js')));
check('Staging storage has staging-specific cache key',html.includes(stageAsset('staging/staging-storage.js')));
check('LIVE browser mirror loads before staging storage interception',html.indexOf('staging/staging-local-seed-v1.js') < html.indexOf('staging/staging-storage.js'));
check('Staging storage loads before Firebase/app application code',html.indexOf('staging/staging-storage.js') < html.indexOf('staging/staging-firebase.js'));
check('Normal core script still uses current live code build',html.includes(`script.js?v=${build}`));
check('Normal inventory compatibility shell remains current build',html.includes(`inventory.js?v=${build}`));
check('Normal dashboard extras remain current build',html.includes(`extras-dashboard.js?v=${build}`));

if(failures.length){console.error('\nSTAGING SHELL TRANSFORM FAILURES:');failures.forEach(x=>console.error('FAIL ',x));process.exit(1);}
console.log(`\nPASS Staging shell transform — app ${build}, staging ${stageBuild}; verified-LIVE mirror loads before isolation and live cloud/fun entrypoints cannot survive`);
