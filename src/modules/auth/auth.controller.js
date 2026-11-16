import { getCurrentUser, loginUser, registerUser } from './auth.service.js';

export async function register(req, res) {
  const user = await registerUser(req.body);
  res.status(201).json({ data: user });
}

export async function login(req, res) {
  const result = await loginUser(req.body);
  res.json({ data: result });
}

export async function me(req, res) {
  const user = await getCurrentUser(req.user.id);
  res.json({ data: user });
}
