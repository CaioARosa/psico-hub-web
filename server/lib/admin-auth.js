function requireAdmin({ verifyIdToken }) {
  return async function adminAuth(req, res, next) {
    const header = req.headers?.authorization ?? '';
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match) {
      return res.status(401).json({ error: 'Token de acesso ausente.' });
    }

    let decoded;
    try {
      decoded = await verifyIdToken(match[1]);
    } catch {
      return res.status(401).json({ error: 'Token de acesso inválido.' });
    }

    if (decoded?.admin !== true) {
      return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }

    req.admin = decoded;
    return next();
  };
}

module.exports = { requireAdmin };
