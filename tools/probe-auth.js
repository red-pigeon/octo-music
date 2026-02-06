// Usage: SERVER_URL=https://your-server.com node tools/probe-auth.js
const url = process.env.SERVER_URL ? `${process.env.SERVER_URL}/Users/AuthenticateByName` : '';

if (!url) {
  console.error('Set SERVER_URL environment variable');
  process.exit(1);
}

(async () => {
  const auth = 'MediaBrowser Client="Octo", Device="Node", DeviceId="octo-test", Version="1.0.0"';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Emby-Authorization': auth,
      'X-MediaBrowser-Authorization': auth,
    },
    body: JSON.stringify({ Username: 'x', Pw: 'y' }),
  });

  const text = await res.text();
  console.log('status', res.status);
  console.log('content-type', res.headers.get('content-type'));
  console.log('server', res.headers.get('server'));
  console.log('www-authenticate', res.headers.get('www-authenticate'));
  console.log('body', text.slice(0, 200));
})();
