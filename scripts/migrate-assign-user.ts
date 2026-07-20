import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccountPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
const targetUid = process.env['MIGRATION_USER_UID'];

if (!serviceAccountPath) {
  console.error('Error: GOOGLE_APPLICATION_CREDENTIALS env var is required');
  process.exit(1);
}
if (!targetUid) {
  console.error('Error: MIGRATION_USER_UID env var is required');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8')) as ServiceAccount;

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrateCollection(name: string): Promise<number> {
  const snap = await db.collection(name).get();
  const docsWithoutUserId = snap.docs.filter((d) => !d.data()['userId']);
  await Promise.all(docsWithoutUserId.map((d) => d.ref.update({ userId: targetUid })));
  console.log(`  ${name}: ${docsWithoutUserId.length}/${snap.size} docs updated`);
  return docsWithoutUserId.length;
}

async function migrateSettingsDoc(fromPath: [string, string], toCollection: string): Promise<void> {
  const [col, id] = fromPath;
  const snap = await db.collection(col).doc(id).get();
  if (!snap.exists) {
    console.log(`  ${col}/${id}: not found, skipping`);
    return;
  }
  await db.collection(toCollection).doc(targetUid!).set(snap.data()!);
  await db.collection(col).doc(id).delete();
  console.log(`  ${col}/${id} → ${toCollection}/${targetUid}: migrated`);
}

async function main() {
  console.log(`Migrating to userId=${targetUid}...\n`);

  console.log('Collections with userId field:');
  await migrateCollection('recipes');
  await migrateCollection('planner');
  await migrateCollection('cart');
  await migrateCollection('programs');

  console.log('\nSingleton settings documents:');
  await migrateSettingsDoc(['settings', 'profile'], 'userProfiles');
  await migrateSettingsDoc(['settings', 'plan'], 'nutritionPlans');

  console.log('\nMigration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
