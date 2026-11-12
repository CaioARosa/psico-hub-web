import { after, afterEach, before, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv;

describe('firestore.rules', () => {
  before(async () => {
    const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-psico-hub',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host,
        port: Number(port),
      },
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it('admin lê e escreve patients, sessions e payments', async () => {
    const db = testEnv.authenticatedContext('u1', { admin: true }).firestore();
    for (const collection of ['patients', 'sessions', 'payments']) {
      const ref = doc(db, collection, 'x');
      await assertSucceeds(setDoc(ref, { ok: true }));
      await assertSucceeds(getDoc(ref));
    }
  });

  it('usuário autenticado sem claim admin é negado', async () => {
    const db = testEnv.authenticatedContext('u2').firestore();
    const ref = doc(db, 'patients', 'x');
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { ok: true }));
  });

  it('anônimo é negado', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const ref = doc(db, 'patients', 'x');
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { ok: true }));
  });

  it('coleção desconhecida é negada para não-admin', async () => {
    const db = testEnv.authenticatedContext('u2').firestore();
    const ref = doc(db, 'unknown', 'x');
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { ok: true }));
  });
});
