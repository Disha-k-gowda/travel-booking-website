function isValidDateString(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function daysBetween(start, end) {
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.ceil((end.getTime() - start.getTime()) / oneDay);
}

function validateBookingPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Booking payload is required.');
    return errors;
  }

  const {
    destinationId,
    customerName,
    email,
    seats,
    startDate,
    endDate,
  } = payload;

  if (!Number.isInteger(destinationId) || destinationId <= 0) {
    errors.push('destinationId must be a positive integer.');
  }

  if (typeof customerName !== 'string' || customerName.trim().length < 2) {
    errors.push('customerName must be at least 2 characters.');
  }

  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push('email must be valid.');
  }

  if (!Number.isInteger(seats) || seats <= 0 || seats > 6) {
    errors.push('seats must be an integer between 1 and 6.');
  }

  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    errors.push('startDate and endDate must be valid dates.');
    return errors;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start < today) {
    errors.push('startDate cannot be in the past.');
  }

  if (end <= start) {
    errors.push('endDate must be after startDate.');
  }

  if (daysBetween(start, end) > 30) {
    errors.push('Booking cannot exceed 30 nights.');
  }

  return errors;
}

function createBooking(db, payload) {
  const validationErrors = validateBookingPayload(payload);
  if (validationErrors.length > 0) {
    return { ok: false, status: 400, errors: validationErrors };
  }

  const destination = db
    .prepare('SELECT * FROM destinations WHERE id = ?')
    .get(payload.destinationId);

  if (!destination) {
    return { ok: false, status: 404, errors: ['Destination not found.'] };
  }

  let booking;
  const execute = db.transaction(() => {
    // Lock and re-read to prevent race condition overbooking.
    const current = db
      .prepare('SELECT availableSlots, basePrice FROM destinations WHERE id = ?')
      .get(payload.destinationId);

    if (!current || current.availableSlots < payload.seats) {
      throw new Error('Insufficient availability.');
    }

    const start = new Date(payload.startDate);
    const end = new Date(payload.endDate);
    const nights = daysBetween(start, end);
    const totalPrice = nights * current.basePrice * payload.seats;

    db.prepare(
      `
      UPDATE destinations
      SET availableSlots = availableSlots - ?
      WHERE id = ?
      `,
    ).run(payload.seats, payload.destinationId);

    const result = db.prepare(
      `
      INSERT INTO bookings
      (userId, destinationId, customerName, email, seats, startDate, endDate, nights, totalPrice, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
      `,
    ).run(
      payload.userId || null,
      payload.destinationId,
      payload.customerName.trim(),
      payload.email.trim().toLowerCase(),
      payload.seats,
      payload.startDate,
      payload.endDate,
      nights,
      totalPrice,
      new Date().toISOString(),
    );

    booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
  });

  try {
    execute();
    return { ok: true, status: 201, booking };
  } catch (error) {
    return {
      ok: false,
      status: 409,
      errors: [error.message === 'Insufficient availability.' ? error.message : 'Booking failed.'],
    };
  }
}

function cancelBooking(db, bookingId) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { ok: false, status: 404, errors: ['Booking not found.'] };
  }
  if (booking.status === 'cancelled') {
    return { ok: false, status: 409, errors: ['Booking already cancelled.'] };
  }

  const execute = db.transaction(() => {
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('cancelled', bookingId);
    db.prepare('UPDATE destinations SET availableSlots = availableSlots + ? WHERE id = ?').run(
      booking.seats,
      booking.destinationId,
    );
  });

  execute();
  return { ok: true, status: 200 };
}

module.exports = {
  validateBookingPayload,
  createBooking,
  cancelBooking,
};
