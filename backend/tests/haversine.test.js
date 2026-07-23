const { haversineDistance, isWithinRange } = require('../src/services/haversine');

describe('Haversine Distance Calculation', () => {
  test('same point returns 0 meters', () => {
    const dist = haversineDistance(5.6037, -0.1870, 5.6037, -0.1870);
    expect(dist).toBeCloseTo(0, 1);
  });

  test('distance within 150m radius returns within: true', () => {
    const result = isWithinRange(5.6037, -0.1870, 5.60388, -0.1870, 150);
    expect(result.within).toBe(true);
    expect(result.distance).toBeLessThan(150);
  });

  test('distance beyond 150m radius returns within: false', () => {
    const result = isWithinRange(5.6037, -0.1870, 5.6057, -0.1870, 150);
    expect(result.within).toBe(false);
    expect(result.distance).toBeGreaterThan(150);
  });

  test('custom radius is respected', () => {
    const within = isWithinRange(5.6037, -0.1870, 5.6042, -0.1870, 100);
    const outside = isWithinRange(5.6037, -0.1870, 5.6042, -0.1870, 30);
    expect(within.within).toBe(true);
    expect(outside.within).toBe(false);
  });

  test('large distance (1km) is correctly rejected', () => {
    const result = isWithinRange(5.6037, -0.1870, 5.6127, -0.1870, 150);
    expect(result.within).toBe(false);
    expect(result.distance).toBeGreaterThan(900);
  });

  test('longitude offset at equator is calculated correctly', () => {
    const dist = haversineDistance(0, 0, 0, 0.001);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });

  test('commutative property holds', () => {
    const d1 = haversineDistance(5.6037, -0.1870, 5.6100, -0.2000);
    const d2 = haversineDistance(5.6100, -0.2000, 5.6037, -0.1870);
    expect(d1).toBeCloseTo(d2, 5);
  });

  test('returns distance as rounded integer', () => {
    const result = isWithinRange(5.6037, -0.1870, 5.6042, -0.1870, 200);
    expect(typeof result.distance).toBe('number');
    expect(Number.isInteger(result.distance)).toBe(true);
  });
});
