const admin = require('firebase-admin');
const serviceAccount = require('../src/config/firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('[Firebase] ✅ Admin SDK Initialized Successfully');
}

module.exports = admin;
