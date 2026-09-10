async function main() {
  const loginRes = await fetch('http://localhost:6001/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@leasemanager.com', password: 'Password123!' }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data?.accessToken ?? loginJson.accessToken;
  console.log('login', loginRes.status, !!token);

  for (const path of ['/maintenance', '/tenant-applications/pending']) {
    const res = await fetch(`http://localhost:6001${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    console.log(path, res.status, text.slice(0, 300));
  }
}
main().catch((e) => console.error(e));
