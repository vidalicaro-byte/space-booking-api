import * as bookingsService from './bookings.service.js';

export async function create(req, res) {
  const booking = await bookingsService.createBooking(req.user.id, req.body);
  res.status(201).json({ data: booking });
}

export async function list(req, res) {
  const { items, meta } = await bookingsService.listBookings(req.validated.query, req.user);
  res.json({ data: items, meta });
}

export async function getOne(req, res) {
  const booking = await bookingsService.getBooking(req.validated.params.id, req.user);
  res.json({ data: booking });
}

export async function cancel(req, res) {
  const booking = await bookingsService.cancelBooking(req.validated.params.id, req.user);
  res.json({ data: booking });
}
