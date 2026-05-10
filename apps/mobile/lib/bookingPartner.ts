// TODO(booking-partner): Replace stub with real Booking.com/Hostelworld API when affiliate accounts approved
export async function getPriceForAccommodation(
  _accommodationId: string,
): Promise<{ status: "unavailable"; reason: "partner_pending" }> {
  return { status: "unavailable", reason: "partner_pending" };
}
