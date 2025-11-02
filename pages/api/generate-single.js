import { buildPrompt } from '../../utils/promptBuilder';

export const config = {
  maxDuration: 60, // Vercel Pro: 60 seconds is plenty for one API call
};

// Model configurations
const MODEL_CONFIGS = {
  'haiku-4.5': {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1000
  },
  'sonnet-4.5': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 1000
  },
  'gemini-2.5-flash': {
    provider: 'google',
    model: 'gemini-2.5-flash',
    maxTokens: 1000
  }
};

async function callAnthropicAPI(prompt, modelConfig) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelConfig.model,
      max_tokens: modelConfig.maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Claude API error');
  }

  const data = await response.json();
  return {
    text: data.content[0].text.trim(),
    usage: {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens
    }
  };
}

async function callGeminiAPI(prompt, modelConfig) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GOOGLE_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: modelConfig.maxTokens,
          temperature: 0.7,
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  
  // Extract text from Gemini's response format
  const generatedText = data.candidates[0].content.parts[0].text.trim();
  
  return {
    text: generatedText,
    usage: {
      // Gemini doesn't provide token counts in same format
      inputTokens: null,
      outputTokens: null
    }
  };
}

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, adjectives, coordinate, selectedModel = 'haiku-4.5' } = req.body;
  
  // Validate inputs
  if (!text || !adjectives || !coordinate) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['text', 'adjectives', 'coordinate']
    });
  }

  // Validate adjectives structure
  if (!adjectives.yPositive || !adjectives.yNegative || 
      !adjectives.xPositive || !adjectives.xNegative) {
    return res.status(400).json({ 
      error: 'Invalid adjectives structure',
      required: ['yPositive', 'yNegative', 'xPositive', 'xNegative']
    });
  }

  // Get model configuration
  const modelConfig = MODEL_CONFIGS[selectedModel];
  if (!modelConfig) {
    return res.status(400).json({ 
      error: 'Invalid model selection',
      model: selectedModel,
      available: Object.keys(MODEL_CONFIGS)
    });
  }

  // Validate API keys based on provider
  if (modelConfig.provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not configured');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Anthropic API key not configured'
    });
  }
  
  if (modelConfig.provider === 'google' && !process.env.GOOGLE_API_KEY) {
    console.error('GOOGLE_API_KEY is not configured');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Google API key not configured'
    });
  }

  try {
    // Build the prompt for this specific coordinate
    const prompt = buildPrompt(text, coordinate, adjectives);
    
    // Call appropriate API based on provider
    let result;
    if (modelConfig.provider === 'anthropic') {
      result = await callAnthropicAPI(prompt, modelConfig);
    } else if (modelConfig.provider === 'google') {
      result = await callGeminiAPI(prompt, modelConfig);
    } else {
      throw new Error('Unknown provider: ' + modelConfig.provider);
    }

    // Return the generated text with metadata
    return res.status(200).json({
      success: true,
      coordinate,
      text: result.text,
      usage: result.usage,
      model: selectedModel
    });

  } catch (error) {
    console.error('Generation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      coordinate,
      model: selectedModel
    });
  }
}