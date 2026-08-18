const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const auth=fs.readFileSync(path.join(root,'firebase-owner-auth-v1.js'),'utf8');
const rules=fs.readFileSync(path.join(root,'firebase-owner-rules-template.txt'),'utf8');
const failures=[];
const check=(name,ok)=>{console.log(ok?'PASS':'FAIL',name);if(!ok)failures.push(name);};

check('Owner bootstrap uses Firebase email/password sign-in',auth.includes('signInWithEmailAndPassword'));
check('Owner bootstrap does not sign in anonymously',!auth.includes('signInAnonymously'));
check('Owner bootstrap rejects anonymous sessions',auth.includes('user?.isAnonymous')&&auth.includes('signOut(auth)'));
check('Owner bootstrap exposes an explicit sign-in gate',auth.includes('requireSignIn'));
check('Owner bootstrap exposes sign-out',auth.includes('signOut: logout'));
check('Owner password is never written to localStorage',!/(localStorage|sessionStorage)\.(setItem|removeItem|clear)/.test(auth));
check('Chosen owner email is not hard-coded in public source',!auth.toLowerCase().includes('customjeepyj@gmail.com'));
check('Rules require one exact owner UID',rules.includes('request.auth.uid == "REPLACE_WITH_OWNER_UID"'));
check('Rules allow public reads only from dedicated customer collections',rules.includes('match /public_customer/')&&rules.includes('match /public_flock/'));
check('Rules keep all other documents owner-only',rules.includes('match /{document=**}')&&rules.includes('allow read, write: if isOwner();'));
check('Rules template does not contain chosen owner email',!rules.toLowerCase().includes('customjeepyj@gmail.com'));

if(failures.length){console.error(`Owner auth checks failed: ${failures.join(', ')}`);process.exit(1);}
console.log('All owner-auth security checks passed.');
