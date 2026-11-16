import { registerUser } from './auth.service.js';

export async function register(req, res) {
  const user = await registerUser(req.body);
  res.status(201).json({ data: user });
}
