const { initializeApp, getApps, getApp } = require('firebase-admin/app');
const { getAuth: getAdminAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// Inicialização lazy: só acontece na primeira chamada, para que o servidor suba
// (e as rotas públicas funcionem) mesmo sem credenciais do Firebase.
function ensureApp() {
  if (getApps().length > 0) return getApp();
  return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'psico-hub-lays' });
}

function getAuth() {
  return getAdminAuth(ensureApp());
}

function getDb() {
  return getFirestore(ensureApp());
}

module.exports = { getAuth, getDb };
