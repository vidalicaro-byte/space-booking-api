import {
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
} from './auth.service.js';

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

export async function refresh(req, res) {
  const tokens = await refreshSession(req.body.refreshToken);
  res.json({ data: tokens });
}

export async function logout(req, res) {
  await logoutUser(req.body.refreshToken);
  res.status(204).send();
}
