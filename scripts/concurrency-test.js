const base = 'http://localhost:3000/api/v1';

const post = (path, body, token) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });

const login = await (
  await post('/auth/login', { email: 'ana@example.com', password: 'senha-forte-123' })
).json();
const token = login.data.accessToken;

const rooms = await (
  await fetch(`${base}/rooms`, { headers: { Authorization: `Bearer ${token}` } })
).json();
const roomId = rooms.data[0].id;

// Dia aleatório no futuro, para poder rodar o script várias vezes
const start = new Date(Date.now() + (10 + Math.floor(Math.random() * 300)) * 24 * 60 * 60 * 1000);
start.setMinutes(0, 0, 0);
const end = new Date(start.getTime() + 60 * 60 * 1000);

const responses = await Promise.all(
  Array.from({ length: 10 }, () =>
    post('/bookings', { roomId, startsAt: start.toISOString(), endsAt: end.toISOString() }, token),
  ),
);

const statuses = responses.map((r) => r.status);
console.log(statuses.join(' '));
console.log(
  '201:',
  statuses.filter((s) => s === 201).length,
  '| 409:',
  statuses.filter((s) => s === 409).length,
);
