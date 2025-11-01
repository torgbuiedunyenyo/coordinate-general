import { buildPrompt } from '../../utils/promptBuilder';

export const config = {
  maxDuration: 60, // Vercel Pro: 60 seconds is plenty for one Claude call
};

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, adjectives, coordinate } = req.body;
  
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

  // Validate API key exists
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not configured');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'API key not configured'
    });
  }

  try {
    // Build the prompt for this specific coordinate
    const prompt = buildPrompt(text, coordinate, adjectives);
    
    // Call Claude Haiku 4.5 API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
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
      console.error('Claude API error:', error);
      return res.status(response.status).json({ 
        error: 'Failed to generate text from Claude API',
        details: error.error?.message || 'Unknown error',
        coordinate
      });
    }

    const data = await response.json();
    
    // Extract text from Claude's response
    const generatedText = data.content[0].text.trim();

    // Return the generated text with metadata
    return res.status(200).json({
      success: true,
      coordinate,
      text: generatedText,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Generation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      coordinate
    });
  }
}
