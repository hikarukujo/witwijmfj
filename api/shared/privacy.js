/**
 * coarsen()
 *
 * Reduces precision of upstream coordinates BEFORE they leave the server.
 * This is the only thing standing between Life360's street-accurate fix and
 * the public web — the function above caches and returns whatever this
 * returns. If you return the raw lat/lon, you have leaked an exact location.
 *
 * Input:
 *   { lat: number, lon: number, place: { city, state, country } }
 *
 * Expected return shape (consumed by App.jsx):
 *   {
 *     coordinates: [number, number],      // [lat, lon] for the map marker
 *     place: { city, state, country },    // already-coarse text labels
 *   }
 *
 * Decision points to consider:
 *   - Decimal rounding: 1 decimal ≈ 11 km, 0 decimals ≈ 111 km, 2 decimals ≈ 1.1 km.
 *   - Snap-to-city: drop the upstream coords entirely and substitute the city
 *     centroid (would require a separate forward-geocode call — more cost).
 *   - Country-only: zero out lat/lon to a country centroid for the highest privacy.
 *   - Hybrid: round when you're at home, full precision when traveling, etc.
 *
 * TODO(you): implement the policy you want. Keep it small (5-10 lines).
 *            The default below rounds to 1 decimal — that's a placeholder, not a
 *            recommendation; pick the precision YOU are comfortable publishing.
 */
function coarsen({ lat, lon, place }) {
  const round = (n, decimals) => {
    const f = 10 ** decimals;
    return Math.round(n * f) / f;
  };

  // TODO: replace this default with your policy.
  const PRECISION_DECIMALS = 1;

  return {
    coordinates: [round(lat, PRECISION_DECIMALS), round(lon, PRECISION_DECIMALS)],
    place,
  };
}

module.exports = { coarsen };
