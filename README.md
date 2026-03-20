# Air Hockey Classic

A high-performance HTML5 canvas Air Hockey game featuring adaptive AI powered by Gemini.

## Tech Stack
- React 19
- HTML5 Canvas for rendering and physics
- Tailwind CSS
- Google Gemini API (for AI opponent behavior)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
Create a `.env.local` file and add your API key:
```env
GEMINI_API_KEY=your_api_key_here
```

3. Start dev server:
```bash
npm run dev
```

## Features
- Custom physics engine with sub-stepping
- Dynamic AI opponent that adapts to the score
- Two modes: Rookie and Pro
