// Generate coordinates for a specific ring
export function getRingCoordinates(ringNumber) {
  if (ringNumber === 0) {
    return ['0,0'];
  }
  
  const coords = [];
  const n = ringNumber;
  
  // Generate all coordinates where max(|x|, |y|) = n
  for (let x = -n; x <= n; x++) {
    for (let y = -n; y <= n; y++) {
      // Only include coordinates where at least one dimension is at max distance
      if (Math.max(Math.abs(x), Math.abs(y)) === n) {
        coords.push(`${x},${y}`);
      }
    }
  }
  
  return coords;
}

// Get all coordinates up to a ring
export function getCoordinatesUpToRing(maxRing) {
  let coords = [];
  for (let ring = 0; ring <= maxRing; ring++) {
    coords = coords.concat(getRingCoordinates(ring));
  }
  return coords;
}

// Get all 121 coordinates
export function getAllCoordinates() {
  return getCoordinatesUpToRing(5);
}

// Get ring number for a coordinate
export function getRingNumber(coordinate) {
  const [x, y] = coordinate.split(',').map(Number);
  return Math.max(Math.abs(x), Math.abs(y));
}

// Validate coordinate format
export function isValidCoordinate(coordinate) {
  if (typeof coordinate !== 'string') return false;
  
  const parts = coordinate.split(',');
  if (parts.length !== 2) return false;
  
  const [x, y] = parts.map(Number);
  return (
    !isNaN(x) && !isNaN(y) &&
    x >= -5 && x <= 5 &&
    y >= -5 && y <= 5 &&
    Number.isInteger(x) && Number.isInteger(y)
  );
}
