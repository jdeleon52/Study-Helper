# Anatomy Study Helper

A mobile-friendly anatomy study web app that runs entirely in the browser. Users can create custom topics and questions, take quizzes, review correct and incorrect answers, inspect quiz history, and follow performance-based study recommendations.

## Features

- Add, edit, search, and remove questions
- Create and remove custom anatomy topics
- Quiz all questions or one selected topic
- Type an answer, reveal the solution, and self-grade
- Detailed score and answer breakdown
- Quiz history, topic accuracy, and frequently missed questions
- Automatic study route recommendations based on performance
- JSON import/export for backups and sharing
- Local browser storage; no account or database required
- Responsive phone, tablet, and desktop interface

## Run locally

1. Install Node.js 20 or newer.
2. Open this folder in a terminal.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the local URL shown in the terminal.

## Create a production build

```bash
npm run build
```

The optimized website will be generated in the `dist` folder. You can deploy the project to Vercel, Netlify, GitHub Pages, or another static host.

## Data and privacy

All questions, topics, and quiz history are stored in the current browser using `localStorage`. Clearing browser site data removes the saved information, so use **Export** to create backups.

## Future expansion

The project is organized so it can later add:

- AI-generated study plans through a protected backend API
- User accounts and cloud synchronization
- Multiple-choice question types
- Anatomy image-labeling exercises
- Spaced repetition scheduling
