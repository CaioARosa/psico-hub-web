const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAdmin } = require('./admin-auth');

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function run(middleware, req) {
  const res = fakeRes();
  let nextCalls = 0;
  await middleware(req, res, () => {
    nextCalls += 1;
  });
  return { res, nextCalls };
}

test('401 sem header Authorization', async () => {
  const mw = requireAdmin({ verifyIdToken: async () => ({ admin: true }) });
  const { res, nextCalls } = await run(mw, { headers: {} });
  assert.equal(res.statusCode, 401);
  assert.ok(res.body.error);
  assert.equal(nextCalls, 0);
});

test('401 quando o header não é Bearer', async () => {
  const mw = requireAdmin({ verifyIdToken: async () => ({ admin: true }) });
  const { res, nextCalls } = await run(mw, { headers: { authorization: 'Basic abc' } });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalls, 0);
});

test('401 quando verifyIdToken rejeita', async () => {
  const mw = requireAdmin({
    verifyIdToken: async () => {
      throw new Error('token inválido');
    },
  });
  const { res, nextCalls } = await run(mw, { headers: { authorization: 'Bearer abc' } });
  assert.equal(res.statusCode, 401);
  assert.ok(res.body.error);
  assert.equal(nextCalls, 0);
});

test('403 quando o token não tem admin', async () => {
  const mw = requireAdmin({ verifyIdToken: async () => ({ uid: 'u1' }) });
  const { res, nextCalls } = await run(mw, { headers: { authorization: 'Bearer abc' } });
  assert.equal(res.statusCode, 403);
  assert.ok(res.body.error);
  assert.equal(nextCalls, 0);
});

test('403 quando admin é truthy mas não é true', async () => {
  const mw = requireAdmin({ verifyIdToken: async () => ({ admin: 'true' }) });
  const { res, nextCalls } = await run(mw, { headers: { authorization: 'Bearer abc' } });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalls, 0);
});

test('chama next e expõe req.admin quando admin é true', async () => {
  const decoded = { uid: 'u1', admin: true };
  let receivedToken;
  const mw = requireAdmin({
    verifyIdToken: async (token) => {
      receivedToken = token;
      return decoded;
    },
  });
  const req = { headers: { authorization: 'Bearer abc.def' } };
  const { res, nextCalls } = await run(mw, req);
  assert.equal(nextCalls, 1);
  assert.equal(res.statusCode, null);
  assert.equal(receivedToken, 'abc.def');
  assert.equal(req.admin, decoded);
});
