// Map coordinate distance to intensity word
const INTENSITIES = ['', 'slightly', 'moderately', 'strongly', 'very strongly', 'extremely'];

export function buildPrompt(originalText, coordinate, adjectives) {
  const [x, y] = coordinate.split(',').map(Number);
  
  // Get intensity based on absolute distance
  const xIntensity = INTENSITIES[Math.abs(x)] || '';
  const yIntensity = INTENSITIES[Math.abs(y)] || '';
  
  // Determine direction
  const xDirection = x > 0 ? adjectives.xPositive : (x < 0 ? adjectives.xNegative : null);
  const yDirection = y > 0 ? adjectives.yPositive : (y < 0 ? adjectives.yNegative : null);
  
  // Build transformation instructions
  const transformations = [];
  
  if (y !== 0 && yDirection) {
    transformations.push(`${yIntensity} more ${yDirection}`.trim());
  }
  
  if (x !== 0 && xDirection) {
    transformations.push(`${xIntensity} more ${xDirection}`.trim());
  }
  
  // Handle center case (0,0)
  if (transformations.length === 0) {
    return `Return the following text exactly as written, without any modifications:

"${originalText}"

Return only the text, without quotes or additional formatting.`;
  }
  
  // Build full prompt
  const instruction = `Rewrite the following text to be ${transformations.join(' and ')}. Keep the same core message and approximately the same length.`;
  
  return `${instruction}

Original text:
"${originalText}"

Rewritten text (provide only the transformed text, without quotes or additional formatting):`;
}

export function validatePromptInputs(text, adjectives) {
  const errors = [];
  
  if (!text || text.trim().length < 50) {
    errors.push('Text must be at least 50 characters');
  }
  
  if (text && text.length > 1000) {
    errors.push('Text must be less than 1000 characters');
  }
  
  if (!adjectives.yPositive?.trim()) {
    errors.push('Y-axis positive adjective is required');
  }
  
  if (!adjectives.yNegative?.trim()) {
    errors.push('Y-axis negative adjective is required');
  }
  
  if (!adjectives.xPositive?.trim()) {
    errors.push('X-axis positive adjective is required');
  }
  
  if (!adjectives.xNegative?.trim()) {
    errors.push('X-axis negative adjective is required');
  }
  
  return errors;
}
