// Uso: node scripts/grant-admin.js <email>
// Dá o custom claim `admin: true` ao usuário com o e-mail informado.
// Credenciais: GOOGLE_APPLICATION_CREDENTIALS (service account) ou ADC do gcloud.
const { getAuth } = require('../lib/firebase');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: node scripts/grant-admin.js <email>');
    process.exit(1);
  }

  const auth = getAuth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`Usuário não encontrado: ${email}. Crie-o antes no console do Firebase (Authentication).`);
      process.exit(1);
    }
    throw error;
  }

  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true });
  console.log(`Claim admin concedido a ${email} (uid ${user.uid}). Faça logout/login para renovar o token.`);
}

main().catch((error) => {
  console.error('Falha ao conceder o claim admin:', error.message ?? error);
  process.exit(1);
});
