const { haversineDistance, isWithinRange, isWithinRangeWithAccuracy, DEFAULT_RADIUS_METERS } = require('../src/services/haversine');

describe('Haversine Distance Calculation', () => {
  test('same point returns 0 meters', () => {
    const dist = haversineDistance(5.6037, -0.1870, 5.6037, -0.1870);
    expect(dist).toBeCloseTo(0, 1);
  });

  test('distance within default 150m threshold returns true', () => {
    // ~20m offset at equator: 0.00018 degrees lat ≈ 20m
    const result = isWithinRange(5.6037, -0.1870, 5.60388, -0.1870);
    expect(result).toBe(true);
  });

  test('distance beyond default 150m threshold returns false', () => {
    // ~220m offset: 0.002 degrees lat ≈ 222m
    const result = isWithinRange(5.6037, -0.1870, 5.6057, -0.1870);
    expect(result).toBe(false);
  });

  test('custom radius is respected', () => {
    // ~55m offset: 0.0005 degrees lat ≈ 55m
    const within = isWithinRange(5.6037, -0.1870, 5.6042, -0.1870, 100);
    const outside = isWithinRange(5.6037, -0.1870, 5.6042, -0.1870, 30);
    expect(within).toBe(true);
    expect(outside).toBe(false);
  });

  test('accuracy-aware: student within radius even if raw distance exceeds it', () => {
    // ~160m offset, but accuracy is 50m -> distance - accuracy = 110m, within 150m
    const result = isWithinRangeWithAccuracy(5.6037, -0.1870, 5.60513, -0.1870, 50, 150);
    expect(result).toBe(true);
  });

  test('accuracy-aware: student rejected if even with accuracy buffer still outside', () => {
    // ~300m offset, accuracy 50m -> 250m, still > 150m
    const result = isWithinRangeWithAccuracy(5.6037, -0.1870, 5.6064, -0.1870, 50, 150);
    expect(result).toBe(false);
  });

  test('accuracy-aware: zero accuracy behaves like standard check', () => {
    // ~55m offset, accuracy 0
    const within = isWithinRangeWithAccuracy(5.6037, -0.1870, 5.6042, -0.1870, 0, 150);
    const outside = isWithinRangeWithAccuracy(5.6037, -0.1870, 5.6042, -0.1870, 0, 30);
    expect(within).toBe(true);
    expect(outside).toBe(false);
  });

  test('large distance (1km) is correctly rejected', () => {
    const result = isWithinRange(5.6037, -0.1870, 5.6127, -0.1870);
    expect(result).toBe(false);
  });

  test('longitude offset at equator is calculated correctly', () => {
    // 0.001 degrees longitude ≈ 111m at equator, ~55m at 5.6° lat
    const dist = haversineDistance(0, 0, 0, 0.001);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });

  test('commutative property holds', () => {
    const d1 = haversineDistance(5.6037, -0.1870, 5.6100, -0.2000);
    const d2 = haversineDistance(5.6100, -0.2000, 5.6037, -0.1870);
    expect(d1).toBeCloseTo(d2, 5);
  });

  test('DEFAULT_RADIUS_METERS is exactly 150', () => {
    expect(DEFAULT_RADIUS_METERS).toBe(150);
  });
});
