# Coordinate General - AI Text Transformation Suite

A comprehensive web application featuring three powerful AI-driven text transformation tools: Coordinate Plane, Text Bridge, and Filter Stack. Built with Next.js and powered by multiple AI models (Claude Haiku 4.5, Claude Sonnet 4.5, and Gemini 2.5 Flash).

## 🎯 Features

### 1. **Coordinate Plane Text Transformer**
Transform text along two customizable adjective dimensions in a 2D space.
- **11×11 Grid**: Generate 121 variations of your text
- **Interactive Exploration**: Drag cursor, click, or use arrow keys to navigate
- **Progressive Generation**: Ring-based generation from center outward
- **Real-time Preview**: See variations instantly as you move through the grid

### 2. **Text Bridge**
Create smooth interpolations between two completely different texts.
- **Recursive Midpoint Blending**: AI generates intermediate variations
- **11 Positions**: Smooth transition from Text A to Text B
- **Interactive Slider**: Explore the full spectrum of blended texts
- **Smart Generation**: 4-round recursive generation for natural transitions

### 3. **Filter Stack** 
Apply Photoshop-like layered text transformations.
- **10 Pre-defined Filters**: Simplify, Formalize, Add Humor, Elaborate, and more
- **Layer System**: Drag-and-drop interface with toggleable layers
- **Adjustable Intensity**: 25%, 50%, 75%, or 100% for each filter
- **Smart Caching**: Efficient regeneration only when needed

## 🚀 Tech Stack

- **Framework**: Next.js 14.1.4
- **React**: 18.x with Hooks (functional components only)
- **AI Models**: 
  - Claude Haiku 4.5 (default - fast & cost-effective)
  - Claude Sonnet 4.5 (advanced reasoning)
  - Gemini 2.5 Flash (Google's fast multimodal model)
- **Styling**: CSS Modules
- **State Management**: SessionStorage with memory fallback
- **Authentication**: Password-protected access
- **Deployment**: Vercel-ready

## 📋 Prerequisites

- Node.js 16.x or higher
- npm or yarn
- API Keys:
  - Anthropic API key (for Claude models)
  - Google API key (for Gemini model) - optional

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/coordinate-general.git
   cd coordinate-general
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure environment variables:**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Required for Claude models
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   
   # Optional for Gemini model
   GOOGLE_API_KEY=your_google_api_key_here
   
   # Password protection (required)
   APP_PASSWORD=your_secure_password_here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000) in your browser**

6. **Enter the password** when prompted (set in `APP_PASSWORD`)

## 📖 Usage Guide

### Coordinate Plane
1. Navigate to **Setup** page
2. Enter your text (50-1000 characters)
3. Choose four adjectives for the axes:
   - Y-axis Positive (top) & Negative (bottom)
   - X-axis Positive (right) & Negative (left)
4. Select AI model and click "Generate Variations"
5. Watch the generation progress (2-5 minutes for all 121 variations)
6. Explore variations by dragging the cursor on the coordinate plane

### Text Bridge
1. Navigate to **Bridge Setup**
2. Enter two different texts (Text A and Text B)
3. Select AI model and click "Generate Bridge"
4. Generation happens in 4 rounds using recursive midpoint blending
5. Use the slider to explore the 11-position bridge between texts

### Filter Stack
1. Navigate to **Filters**
2. Enter your text and click "Start Filtering"
3. Add filters by:
   - Clicking filter buttons
   - Drag-and-drop from available filters
4. Adjust layer settings:
   - Toggle layers on/off
   - Adjust intensity (25-100%)
   - Reorder by dragging layers
5. View real-time transformations in the preview panel

## 📁 Project Structure

```
coordinate-general/
├── pages/
│   ├── index.js                 # Entry point (redirects to setup)
│   ├── password.js              # Password authentication
│   ├── setup.js                 # Coordinate Plane setup
│   ├── generate.js              # Coordinate Plane generation
│   ├── explore.js               # Coordinate Plane exploration
│   ├── bridge-setup.js          # Bridge feature setup
│   ├── bridge-generate.js       # Bridge generation progress
│   ├── bridge-explore.js        # Bridge exploration interface
│   ├── filters.js               # Filter Stack interface
│   └── api/
│       ├── generate-single.js   # Unified API endpoint
│       └── verify-password.js   # Password verification
├── utils/
│   ├── authManager.js           # Authentication management
│   ├── sessionManager.js        # Coordinate Plane session
│   ├── bridgeSessionManager.js  # Bridge session management
│   ├── filterSessionManager.js  # Filter Stack session
│   ├── promptBuilder.js         # Coordinate prompts
│   ├── bridgePromptBuilder.js   # Bridge prompts
│   ├── filterDefinitions.js     # Filter configurations
│   ├── ringGenerator.js         # Ring-based generation
│   ├── bridgeGenerator.js       # Bridge generation logic
│   ├── filterCacheManager.js    # Filter caching system
│   ├── performanceMonitor.js    # API performance tracking
│   └── mobileDetection.js       # Mobile device detection
├── styles/
│   ├── globals.css              # Global styles
│   ├── Home.module.css          # Explore page styles
│   ├── Setup.module.css         # Setup form styles
│   ├── Generate.module.css      # Generation page styles
│   ├── Bridge.module.css        # Bridge feature styles
│   ├── Filters.module.css       # Filter Stack styles
│   └── Password.module.css      # Password page styles
└── public/
    └── Footer.js                # Footer component
```

## ⚡ Performance & Architecture

### Client-Side Orchestration
- Browser manages generation loops to avoid server timeouts
- Individual API calls per transformation
- Progressive generation enables early exploration

### Smart Batching
Model-specific concurrent request limits:
- **Gemini 2.5 Flash**: 15 concurrent requests
- **Claude Haiku 4.5**: 8 concurrent requests  
- **Claude Sonnet 4.5**: 6 concurrent requests

### Caching Strategy
- Session data stored in sessionStorage
- Memory fallback for restricted browsers
- Filter Stack uses smart caching to minimize API calls

### Rate Limiting
- Exponential backoff retry logic
- Model-specific delay configurations
- Automatic retry for overloaded errors

## 💰 API Cost Estimation

### Coordinate Plane (121 variations)
| Model | Input Cost | Output Cost | Total per Session |
|-------|------------|-------------|-------------------|
| Claude Haiku 4.5 | $0.018 | $0.090 | ~$0.11 |
| Claude Sonnet 4.5 | $0.054 | $0.450 | ~$0.50 |
| Gemini 2.5 Flash | $0.014 | $0.054 | ~$0.07 |

### Text Bridge (9 generations)
Approximately 7-10% of Coordinate Plane costs

### Filter Stack
Cost varies by number of filters and intensity changes

## 🚢 Deployment to Vercel

1. **Push code to GitHub**

2. **Connect repository to Vercel**

3. **Configure environment variables in Vercel:**
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_API_KEY` (optional)
   - `APP_PASSWORD`

4. **Deploy**

The app is optimized for Vercel with:
- 60-second timeout handling
- Edge function compatibility
- Automatic SSL/HTTPS

## 🔧 Development Commands

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## 📱 Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

### Mobile Features
- Touch-optimized controls
- Responsive layouts
- Navigation helpers for small screens
- Position buttons for Text Bridge

## 🔒 Security

- Password-protected access (24-hour sessions)
- API keys stored securely in environment variables
- Session-based authentication
- No database - all data stored client-side

## 🎨 Customization

### Adding New Filters
Edit `utils/filterDefinitions.js` to add custom filters:
```javascript
{
  id: 'custom',
  name: 'Custom Filter',
  description: 'Your description',
  defaultIntensity: 50,
  icon: '🎯'
}
```

### Adjusting Generation Parameters
Modify batch sizes and delays in:
- `pages/generate.js` (Coordinate Plane)
- `pages/bridge-generate.js` (Bridge)
- `pages/filters.js` (Filter Stack)

## 📊 Performance Monitoring

The app includes built-in performance monitoring:
- API call timing
- Batch processing metrics
- Session duration tracking
- Token usage calculation

Access metrics via `utils/performanceMonitor.js`

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Anthropic for Claude API
- Google for Gemini API
- Vercel for hosting platform
- Next.js team for the framework

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact the administrator for password access
- Check the documentation in `/docs` folder

---

**Note**: This application requires valid API keys and has associated costs based on usage. Monitor your API usage to manage expenses.
### Personal provider migration (October 2026)

Production uses personal Anthropic and Google Gemini keys. Saved model-selection IDs remain compatible: `sonnet-4.5` calls Claude Sonnet 4.6 and `gemini-2.5-flash` calls Gemini 3.8 Flash. Google no longer admits new users to Gemini 2.5 Flash. The Gemini request omits sampling parameters unsupported by 3.8. Earlier model pricing and quota examples above are historical estimates, not current provider guarantees.

Set `ANTHROPIC_API_KEY` and `GOOGLE_API_KEY` privately before starting the app. `node scripts/account-migration-smoke.mjs` verifies all three real provider routes against `SMOKE_BASE_URL`; it does not write application data.
