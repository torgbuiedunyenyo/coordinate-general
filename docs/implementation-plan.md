# Implementation Plan: Generalized Coordinate Plane

## Architecture Overview

**Client-Side Orchestration (Vercel Compatible):**
```
Browser JavaScript
    ↓ loops through 121 coordinates
    ↓ makes individual fetch calls
    ↓
API: /api/generate-single.js (ONE coordinate at a time)
    ↓ 5-15 seconds per call
    ↓
Claude Sonnet 4.5 API
```

**Why this works on Vercel Pro:**
- Each API call: <60 seconds (well under 300s max)
- No single long-running function
- Progressive results stored in browser
- User can close/reopen tab (sessionStorage persists)

## File Structure
```
pages/
  index.js              → Redirects to /setup
  setup.js              → NEW: Form for text + adjectives
  generate.js           → NEW: Loading/progress screen
  explore.js            → NEW: Interactive coordinate plane
  api/
    generate-single.js  → NEW: Generates ONE coordinate
  _app.js               → Next.js app wrapper
  _document.js          → Next.js document structure

utils/
  sessionManager.js     → NEW: sessionStorage helpers
  promptBuilder.js      → NEW: Dynamic prompt construction
  ringGenerator.js      → NEW: Ring coordinate mapping

styles/
  Home.module.css       → Explore page styles
  Setup.module.css      → Setup form styles
  Generate.module.css   → Loading screen styles
  globals.css           → Global styles

public/
  Footer.js             → Footer component

docs/
  implementation-plan.md → This file

.cursor/
  rules/
    coordinate-plane.mdc → Project rules

.env.local              → ANTHROPIC_API_KEY
vercel.json             → Function config
```

## Session Storage Schema
```javascript
{
  originalText: string,          // User's input text
  adjectives: {
    yPositive: string,           // Top (e.g., "Ominous")
    yNegative: string,           // Bottom (e.g., "Auspicious")
    xPositive: string,           // Right (e.g., "Metaphorical")
    xNegative: string            // Left (e.g., "Literal")
  },
  generations: {
    "0,0": string,               // Generated text for center
    "1,0": string,               // Generated text for (1,0)
    "-2,3": string,              // etc... up to 121 entries
  },
  progress: {
    currentRing: number,         // 0-5
    totalGenerated: number,      // 0-121
    status: string               // "idle" | "generating" | "complete" | "error"
  }
}
```

## Ring Coordinate Mapping

**Ring 0:** (0,0) - 1 point
**Ring 1:** 8 points - all coordinates where max(|x|, |y|) = 1
- (0,1), (1,1), (1,0), (1,-1), (0,-1), (-1,-1), (-1,0), (-1,1)

**Ring 2:** 16 points - max(|x|, |y|) = 2
**Ring 3:** 24 points - max(|x|, |y|) = 3
**Ring 4:** 32 points - max(|x|, |y|) = 4
**Ring 5:** 40 points - max(|x|, |y|) = 5

Total: 121 points

## Prompt Construction Logic

For coordinate (x, y):

1. **Calculate intensities:**
   - |0| → "" (no change)
   - |1| → "slightly"
   - |2| → "moderately"
   - |3| → "strongly"
   - |4| → "very strongly"
   - |5| → "extremely"

2. **Determine directions:**
   - x > 0 → xPositive adjective
   - x < 0 → xNegative adjective
   - y > 0 → yPositive adjective
   - y < 0 → yNegative adjective

3. **Build instruction:**
   ```
   Rewrite the following text to be [Y-intensity] more [Y-adjective] and [X-intensity] more [X-adjective]. Keep the same core message and approximately the same length.
   
   Original text:
   "[user's text]"
   
   Rewritten text:
   ```

**Example for (3, -2):**
```
Rewrite the following text to be moderately more Auspicious and strongly more Metaphorical. Keep the same core message and approximately the same length.
```

## User Flow

1. **Setup Screen** (`/setup`)
   - User enters text (50-1000 chars)
   - User enters 4 adjectives
   - Validation → Save to sessionStorage → Redirect to `/generate`

2. **Generation Screen** (`/generate`)
   - Display 11×11 grid showing progress
   - JavaScript loops through coordinates:
     - Ring 0 (1 point) → Show "Start Exploring" button
     - Rings 1-5 continue in background
   - Each coordinate: fetch → update sessionStorage → update UI
   - User can click "Start Exploring" after Ring 0

3. **Exploration Screen** (`/explore`)
   - Load generations from sessionStorage
   - Interactive coordinate plane (drag, click, arrow keys)
   - If coordinate missing: show "Generating..." + trigger fetch
   - "Start Over" button → clear session → return to setup

## Error Handling

- **API timeout:** Retry 3 times with exponential backoff
- **Missing session data:** Redirect to /setup
- **Invalid adjectives/text:** Show inline validation errors
- **Network errors:** Show "Connection lost" + retry button
- **Missing coordinate:** Generate on-demand when user drags there
