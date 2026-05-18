// Rounds upstream coordinates to ~11 km before they leave the server.
// This is the only thing between Life360's street-accurate fix and the public web.
const PRECISION_DECIMALS = 1;

export function coarsen({ lat, lon, place }) {
  const round = (n, decimals) => {
    const f = 10 ** decimals;
    return Math.round(n * f) / f;
  };

  return {
    coordinates: [round(lat, PRECISION_DECIMALS), round(lon, PRECISION_DECIMALS)],
    place,
  };
}
