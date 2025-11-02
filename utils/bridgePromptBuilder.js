// Bridge Prompt Builder - Recursive midpoint blending

export function buildBridgePrompt(textLeft, textRight) {
  // Always use the same 50/50 blend instruction for recursive midpoint generation
  return `Create a new passage that is a perfect 50/50 blend between these two texts.

TEXT LEFT:
"${textLeft}"

TEXT RIGHT:
"${textRight}"

Your task: Write a new passage that sits exactly halfway between these two texts.

BLEND EQUALLY:
- Content & themes: 50% from left, 50% from right
- Writing style: 50% from left, 50% from right
- Tone & mood: 50% from left, 50% from right
- Length: Average the two texts

REQUIREMENTS:
- Create something NEW that synthesizes both texts
- Do NOT quote directly from either text
- Write a coherent, standalone passage
- The result should feel naturally positioned between them
- Maintain smooth flow and internal logic

Write only the blended passage:`;
}

export function validateBridgeInputs(textA, textB) {
  const errors = [];
  
  if (!textA || textA.trim().length < 50) {
    errors.push('Text A must be at least 50 characters');
  }
  
  if (textA && textA.length > 1000) {
    errors.push('Text A must be less than 1000 characters');
  }
  
  if (!textB || textB.trim().length < 50) {
    errors.push('Text B must be at least 50 characters');
  }
  
  if (textB && textB.length > 1000) {
    errors.push('Text B must be less than 1000 characters');
  }
  
  // Warning if texts are identical (but not an error)
  if (textA && textB && textA.trim() === textB.trim()) {
    errors.push('Warning: Text A and Text B are identical. Bridge will have no variation.');
  }
  
  return errors;
}
