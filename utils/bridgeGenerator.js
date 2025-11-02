// Bridge Generator - Recursive midpoint generation order logic

/**
 * Get positions to generate for a specific round
 * @param {number} round - Round number (1-4)
 * @returns {number[]} Array of positions to generate in this round
 */
export function getRoundPositions(round) {
  switch (round) {
    case 1:
      return [5]; // Center
    case 2:
      return [2, 7]; // Quarters
    case 3:
      return [1, 3, 6, 8]; // Eighths
    case 4:
      return [4, 9]; // Final gaps
    default:
      return [];
  }
}

/**
 * Get the dependencies (left and right positions) needed to generate a position
 * @param {number} position - Position to generate (1-9)
 * @returns {[number, number]} [leftPosition, rightPosition]
 */
export function getPositionDependencies(position) {
  // Map each position to its dependencies
  const dependencies = {
    5: [0, 10],   // Center: blend anchors
    2: [0, 5],    // Quarter 1: blend left anchor and center
    7: [5, 10],   // Quarter 2: blend center and right anchor
    1: [0, 2],    // Eighth 1: blend left anchor and quarter 1
    3: [2, 5],    // Eighth 2: blend quarter 1 and center
    6: [5, 7],    // Eighth 3: blend center and quarter 2
    8: [7, 10],   // Eighth 4: blend quarter 2 and right anchor
    4: [3, 5],    // Final gap 1: blend eighth 2 and center
    9: [8, 10]    // Final gap 2: blend eighth 4 and right anchor
  };
  
  return dependencies[position] || null;
}

/**
 * Get all positions in order (0-10)
 * @returns {number[]} Array of all positions
 */
export function getAllPositions() {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
}

/**
 * Get generation order for all positions (excluding anchors 0 and 10)
 * @returns {number[]} Array of positions in generation order
 */
export function getGenerationOrder() {
  return [5, 2, 7, 1, 3, 6, 8, 4, 9];
}

/**
 * Check if a position can be generated based on available positions
 * @param {number} position - Position to check
 * @param {Object} availablePositions - Object with position keys
 * @returns {boolean} True if position can be generated
 */
export function canGeneratePosition(position, availablePositions) {
  const deps = getPositionDependencies(position);
  if (!deps) return false;
  
  const [left, right] = deps;
  return availablePositions[left] !== undefined && 
         availablePositions[right] !== undefined;
}

/**
 * Get the next positions that can be generated based on current state
 * @param {Object} availablePositions - Object with position keys
 * @returns {number[]} Array of positions that can be generated next
 */
export function getNextGenerablePositions(availablePositions) {
  const order = getGenerationOrder();
  const generablePositions = [];
  
  for (const pos of order) {
    // Skip if already generated
    if (availablePositions[pos] !== undefined) continue;
    
    // Check if dependencies are available
    if (canGeneratePosition(pos, availablePositions)) {
      generablePositions.push(pos);
    }
  }
  
  return generablePositions;
}

/**
 * Get round number for a position
 * @param {number} position - Position number
 * @returns {number} Round number (1-4)
 */
export function getPositionRound(position) {
  if (position === 5) return 1;
  if (position === 2 || position === 7) return 2;
  if ([1, 3, 6, 8].includes(position)) return 3;
  if (position === 4 || position === 9) return 4;
  return 0; // Anchors
}

/**
 * Calculate total positions for rounds up to and including specified round
 * @param {number} round - Round number (1-4)
 * @returns {number} Total positions generated
 */
export function getTotalPositionsUpToRound(round) {
  if (round === 0) return 0;
  if (round === 1) return 1;  // Position 5
  if (round === 2) return 3;  // Positions 5, 2, 7
  if (round === 3) return 7;  // Positions 5, 2, 7, 1, 3, 6, 8
  if (round === 4) return 9;  // All positions
  return 9;
}
