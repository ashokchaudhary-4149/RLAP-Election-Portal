# RLAP Election Portal — launch package

This package adds real online submissions and a private admin panel to the RLAP candidate form.

## Local test
1. Install Node.js 20+.
2. Run `npm install`.
3. Set `ADMIN_PASSWORD` and `SESSION_SECRET` environment variables.
4. Run `npm start`.
5. Open `http://localhost:3000/`.
6. Admin: `http://localhost:3000/admin`.

## Deployment
Deploy this Node app on a host that supports persistent disk (or attach a persistent volume), such as a suitable VPS/Node host. Set the two environment variables there and use HTTPS.

Do not put the admin password in the HTML/JavaScript. The database and uploaded photos are server-side.
