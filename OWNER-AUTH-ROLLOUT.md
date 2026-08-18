# Owner authentication rollout

Status: PREPARED ONLY — not active on the live farm yet.

Use this order so the working farm cannot be accidentally locked out:

1. Enable Firebase Email/Password authentication while leaving the current Anonymous provider enabled.
2. Create the one owner password account in Firebase Console.
3. Copy that account's Firebase UID. Do not store the password in this repository.
4. Replace `REPLACE_WITH_OWNER_UID` in `firebase-owner-rules-template.txt` with that UID and publish the Firestore rules.
5. Verify the owner can authenticate before changing the farm Firebase entrypoint.
6. Update `firebase.js` to load `firebase-owner-auth-v1.js`, await `FarmOwnerAuth.requireSignIn()`, and only then load `firebase-safe-v9.js`.
7. Run the full staging/integrity/browser tests and verify the private farm loads, saves, photos sync, inventory works, and customer public collections remain the only unauthenticated reads.
8. Publish and verify the sanitized customer snapshot and public `/view/` page.
9. Only after all checks pass, disable Firebase Anonymous authentication.

Security boundary:

- `public_customer/**`: public read, owner UID write only.
- `public_flock/**`: public read, owner UID write only.
- Every other Firestore path: owner UID read/write only.

Never commit an owner password. The chosen owner email also does not need to be hard-coded in the repository.
