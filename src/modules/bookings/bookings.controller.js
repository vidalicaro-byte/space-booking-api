import * as bookingsService from './bookings.service.js';

export async function create(req, res) {
  const booking = await bookingsService.createBooking(req.user.id, req.body);
  res.status(201).json({ data: booking });
}
