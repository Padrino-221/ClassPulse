/**
 * Haversine distance calculation for building geofencing.
 * Uses plain distance — no accuracy buffer.
 * Accuracy gating is handled on the frontend before submission.
 */

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function isWithinRange(lat1, lon1, lat2, lon2, radiusMeters) {
  const distance = haversineDistance(lat1, lon1, lat2, lon2);
  return { within: distance <= radiusMeters, distance: Math.round(distance) };
}

module.exports = { haversineDistance, isWithinRange };
