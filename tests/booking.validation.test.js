const { validateBookingPayload } = require('../src/bookingService');

describe('validateBookingPayload', () => {
  test('accepts a valid payload', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 6);

    const errors = validateBookingPayload({
      destinationId: 1,
      customerName: 'Ada Lovelace',
      email: 'ada@example.com',
      seats: 2,
      startDate: tomorrow.toISOString().slice(0, 10),
      endDate: nextWeek.toISOString().slice(0, 10),
    });

    expect(errors).toHaveLength(0);
  });

  test('rejects past dates and seat overflow', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const errors = validateBookingPayload({
      destinationId: 1,
      customerName: 'A',
      email: 'not-an-email',
      seats: 10,
      startDate: yesterday.toISOString().slice(0, 10),
      endDate: yesterday.toISOString().slice(0, 10),
    });

    expect(errors).toContain('customerName must be at least 2 characters.');
    expect(errors).toContain('email must be valid.');
    expect(errors).toContain('seats must be an integer between 1 and 6.');
    expect(errors).toContain('startDate cannot be in the past.');
    expect(errors).toContain('endDate must be after startDate.');
  });
});
