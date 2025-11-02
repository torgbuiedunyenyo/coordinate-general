// Filter configurations
export const AVAILABLE_FILTERS = [
  {
    id: 'simplify',
    name: 'Simplify',
    description: 'Make clearer and more direct',
    defaultIntensity: 50,
    icon: '📝'
  },
  {
    id: 'formalize',
    name: 'Formalize',
    description: 'Use sophisticated vocabulary',
    defaultIntensity: 50,
    icon: '🎩'
  },
  {
    id: 'humor',
    name: 'Add Humor',
    description: 'Add wit and playfulness',
    defaultIntensity: 50,
    icon: '😄'
  },
  {
    id: 'elaborate',
    name: 'Elaborate',
    description: 'Add detail and examples',
    defaultIntensity: 50,
    icon: '📚'
  },
  {
    id: 'concise',
    name: 'Make Concise',
    description: 'Reduce length, keep message',
    defaultIntensity: 50,
    icon: '✂️'
  },
  {
    id: 'dramatize',
    name: 'Dramatize',
    description: 'Heighten emotional intensity',
    defaultIntensity: 50,
    icon: '🎭'
  },
  {
    id: 'casual',
    name: 'Make Casual',
    description: 'Use conversational tone',
    defaultIntensity: 50,
    icon: '👋'
  },
  {
    id: 'technical',
    name: 'Make Technical',
    description: 'Use precise, specialized language',
    defaultIntensity: 50,
    icon: '⚙️'
  },
  {
    id: 'empathetic',
    name: 'Add Empathy',
    description: 'Show understanding and compassion',
    defaultIntensity: 50,
    icon: '❤️'
  },
  {
    id: 'persuasive',
    name: 'Make Persuasive',
    description: 'Add compelling arguments',
    defaultIntensity: 50,
    icon: '💪'
  }
];

// Intensity mapping (25, 50, 75, 100 only)
export const INTENSITY_WORDS = {
  25: 'slightly',
  50: 'moderately',
  75: 'strongly',
  100: 'extremely'
};

// Prompt builder for filter transformations
export function buildFilterPrompt(inputText, filterId, intensity) {
  // Intensity must be 25, 50, 75, or 100
  if (![25, 50, 75, 100].includes(intensity)) {
    throw new Error(`Invalid intensity: ${intensity}. Must be 25, 50, 75, or 100.`);
  }
  
  const intensityWord = INTENSITY_WORDS[intensity];
  
  const filterInstructions = {
    simplify: `Make this text ${intensityWord} simpler and more direct. Use clearer language, shorter sentences, and everyday vocabulary. Keep the core message intact.`,
    
    formalize: `Make this text ${intensityWord} more formal. Use sophisticated vocabulary, professional tone, proper grammar, and avoid contractions or colloquialisms. Maintain the core meaning.`,
    
    humor: `Add ${intensityWord} more humor to this text. Include witty asides, playful language, clever wordplay, or amusing observations while preserving the core message.`,
    
    elaborate: `Expand this text with ${intensityWord} more detail and explanation. Add examples, context, background information, and supporting details to enhance understanding.`,
    
    concise: `Make this text ${intensityWord} more concise. Remove unnecessary words, redundancy, and verbosity while preserving the complete meaning and all essential information.`,
    
    dramatize: `Make this text ${intensityWord} more dramatic. Heighten the emotional intensity, raise the stakes, amplify the impact, and increase the sense of urgency or importance.`,
    
    casual: `Make this text ${intensityWord} more casual. Use conversational tone, contractions, informal language, and friendly phrasing as if speaking to a friend. Keep the meaning clear.`,
    
    technical: `Make this text ${intensityWord} more technical. Use precise terminology, specialized vocabulary, technical concepts, and domain-specific language appropriate to the subject matter.`,
    
    empathetic: `Add ${intensityWord} more empathy to this text. Show understanding, compassion, emotional awareness, and genuine concern for the reader's perspective and feelings.`,
    
    persuasive: `Make this text ${intensityWord} more persuasive. Add compelling arguments, evidence, rhetorical techniques, appeals to logic or emotion, and convincing language to influence the reader.`
  };
  
  const instruction = filterInstructions[filterId];
  
  if (!instruction) {
    throw new Error(`Unknown filter: ${filterId}`);
  }
  
  return `${instruction}

Input text:
"${inputText}"

Transformed text (provide only the result, without quotes or additional formatting):`;
}

// Validate filter inputs
export function validateFilterInputs(text) {
  const errors = [];
  
  if (!text || text.trim().length < 50) {
    errors.push('Text must be at least 50 characters');
  }
  
  if (text && text.length > 1000) {
    errors.push('Text must be less than 1000 characters');
  }
  
  return errors;
}

// Calculate cost estimate (approximate)
export function calculateCostEstimate(tokens, model) {
  const pricing = {
    'haiku-4.5': { input: 0.25 / 1000000, output: 1.25 / 1000000 },
    'sonnet-4.5': { input: 3.00 / 1000000, output: 15.00 / 1000000 },
    'gemini-2.5-flash': { input: 0.075 / 1000000, output: 0.30 / 1000000 }
  };
  
  const rates = pricing[model] || pricing['haiku-4.5'];
  const inputCost = tokens.input * rates.input;
  const outputCost = tokens.output * rates.output;
  const total = inputCost + outputCost;
  
  return {
    inputCost,
    outputCost,
    total,
    formatted: `$${total.toFixed(4)}`
  };
}
