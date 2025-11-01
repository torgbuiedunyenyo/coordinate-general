# Coordinate Plane Text Transformer

An interactive web application that transforms text along two adjective dimensions using Claude Haiku 4.5 API. Explore 121 AI-generated variations of your text in a visual coordinate plane.

## Features

- **Two-Dimensional Text Transformation**: Transform text along two customizable adjective axes
- **Visual Exploration**: Interactive 11×11 coordinate plane with drag, click, and keyboard navigation
- **Progressive Generation**: Start exploring after the center point generates while the rest processes in background
- **Client-Side Orchestration**: Vercel-compatible architecture with individual API calls per coordinate
- **Session Persistence**: Uses sessionStorage to maintain state across page refreshes
- **Mobile Responsive**: Works on desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 14.1.4
- **React**: 18.x with Hooks
- **AI Model**: Claude Haiku 4.5 (Anthropic)
- **Styling**: CSS Modules
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn
- Anthropic API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/coordinate-general.git
   cd coordinate-general
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Setup**: Enter your text (50-1000 characters) and choose four adjectives for the axes
2. **Generation**: Watch as the AI generates 121 variations (takes 2-5 minutes)
3. **Exploration**: Drag the cursor around the coordinate plane to explore variations
   - Use arrow keys for precise movement
   - Click anywhere on the grid to jump to a position
   - Start exploring after the center generates

## Project Structure

```
coordinate-general/
├── pages/
│   ├── index.js              # Redirects to setup
│   ├── setup.js              # Text and adjective input form
│   ├── generate.js           # Progress tracking during generation
│   ├── explore.js            # Interactive coordinate plane
│   └── api/
│       └── generate-single.js # API endpoint for single coordinate
├── utils/
│   ├── sessionManager.js     # SessionStorage helpers
│   ├── promptBuilder.js      # Dynamic prompt construction
│   └── ringGenerator.js      # Ring-based coordinate mapping
├── styles/
│   ├── globals.css           # Global styles
│   ├── Home.module.css       # Explore page styles
│   ├── Setup.module.css      # Setup form styles
│   └── Generate.module.css   # Generation page styles
├── public/
│   └── Footer.js             # Footer component
└── .cursor/
    └── rules/
        └── coordinate-plane.mdc # Project-specific Cursor rules
```

## Architecture

The app uses client-side orchestration to avoid Vercel timeout limits:

1. Browser JavaScript loops through 121 coordinates
2. Makes individual API calls (one coordinate at a time)
3. Each API call takes 5-15 seconds (well under Vercel's limits)
4. Results stored in sessionStorage immediately
5. Ring-based generation (center first, then outward)

## API Cost Estimation

Using Claude Haiku 4.5:
- **Per session**: ~$0.11 (121 variations)
- **Input**: ~18,000 tokens = $0.018 (at $1 per million tokens)
- **Output**: ~18,000 tokens = $0.090 (at $5 per million tokens)
- **100 users/day**: ~$11/day

## Deployment to Vercel

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Add environment variable in Vercel dashboard:
   - `ANTHROPIC_API_KEY` = your API key
4. Deploy

## Configuration

- **Model**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Max tokens**: 1000 per generation
- **Timeout**: 60 seconds per coordinate
- **Batch size**: 2 parallel requests (reduced to avoid API overload)
- **Batch delay**: 2 seconds between batches
- **Retry delay**: 5-20 seconds for overloaded errors (with exponential backoff)

## Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
