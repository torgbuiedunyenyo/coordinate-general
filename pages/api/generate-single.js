import { buildPrompt } from '../../utils/promptBuilder';
import { buildFilterPrompt } from '../../utils/filterDefinitions';

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
    maxTokens: 8192  // Increased token limit for Gemini
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
  const apiKey = process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google API key is not configured');
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.model}:generateContent?key=${apiKey}`;
  
  const requestBody = {
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
      candidateCount: 1,
      topK: 40,
      topP: 0.95
    }
  };
  
  console.log('Calling Gemini API with model:', modelConfig.model);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error response:', response.status, errorText);
    
    let errorMessage = 'Gemini API error';
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
    } catch (e) {
      errorMessage = `Gemini API error (${response.status}): ${errorText.substring(0, 200)}`;
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // Check if response has the expected structure
  if (!data.candidates || !data.candidates[0]) {
    console.error('Unexpected Gemini response structure:', JSON.stringify(data));
    throw new Error('Invalid response from Gemini API');
  }
  
  // Extract text from Gemini's response format
  const candidate = data.candidates[0];
  
  // Check for finish reason issues
  if (candidate.finishReason === 'MAX_TOKENS') {
    console.error('Gemini hit max token limit. Response:', JSON.stringify(candidate));
    throw new Error('Gemini API hit token limit. Try shorter text or simpler transformations.');
  }
  
  if (candidate.finishReason === 'SAFETY') {
    console.error('Gemini blocked for safety. Response:', JSON.stringify(candidate));
    throw new Error('Gemini API blocked the content for safety reasons.');
  }
  
  // Check for actual content
  if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0] || !candidate.content.parts[0].text) {
    console.error('Missing text content in Gemini response:', JSON.stringify(candidate));
    throw new Error(`Gemini API returned no text content (finish reason: ${candidate.finishReason || 'unknown'})`);
  }
  
  const generatedText = candidate.content.parts[0].text.trim();
  
  return {
    text: generatedText,
    usage: {
      // Gemini provides token counts in usageMetadata
      inputTokens: data.usageMetadata?.promptTokenCount || null,
      outputTokens: data.usageMetadata?.candidatesTokenCount || null
    }
  };
}

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    mode, 
    text, 
    adjectives, 
    coordinate, 
    textLeft, 
    textRight,
    // Filter mode params
    inputText,
    filterId,
    intensity,
    selectedModel = 'haiku-4.5' 
  } = req.body;

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
    let prompt;
    
    if (mode === 'filter') {
      // Filter mode
      if (!inputText || !filterId || intensity === undefined) {
        return res.status(400).json({ 
          error: 'Filter mode requires inputText, filterId, and intensity' 
        });
      }
      
      // Validate intensity is in valid range
      if (intensity < 25 || intensity > 100 || intensity % 25 !== 0) {
        return res.status(400).json({
          error: 'Intensity must be 25, 50, 75, or 100'
        });
      }
      
      prompt = buildFilterPrompt(inputText, filterId, intensity);
      
    } else if (mode === 'bridge') {
      // Bridge mode: use textLeft and textRight
      if (!textLeft || !textRight) {
        return res.status(400).json({ 
          error: 'Bridge mode requires textLeft and textRight' 
        });
      }
      
      // Import bridge prompt builder
      const { buildBridgePrompt } = require('../../utils/bridgePromptBuilder');
      prompt = buildBridgePrompt(textLeft, textRight);
      
    } else {
      // Original coordinate mode
      if (!text || !adjectives || !coordinate) {
        return res.status(400).json({ 
          error: 'Coordinate mode requires text, adjectives, coordinate' 
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
      
      prompt = buildPrompt(text, coordinate, adjectives);
    }
    
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
      coordinate: mode === 'bridge' ? undefined : coordinate,
      text: result.text,
      usage: result.usage,
      model: selectedModel
    });

  } catch (error) {
    console.error('Generation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      coordinate: mode === 'bridge' ? undefined : coordinate,
      model: selectedModel
    });
  }
}