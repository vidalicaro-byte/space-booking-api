import * as roomsService from './rooms.service.js';

export async function list(req, res) {
  const { items, meta } = await roomsService.listRooms(req.validated.query, req.user);
  res.json({ data: items, meta });
}

export async function getOne(req, res) {
  const room = await roomsService.getRoom(req.validated.params.id, req.user);
  res.json({ data: room });
}

export async function create(req, res) {
  const room = await roomsService.createRoom(req.body);
  res.status(201).json({ data: room });
}

export async function update(req, res) {
  const room = await roomsService.updateRoom(req.validated.params.id, req.body);
  res.json({ data: room });
}

export async function remove(req, res) {
  await roomsService.deactivateRoom(req.validated.params.id);
  res.status(204).send();
}
