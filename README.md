# Ptitch Perfect

A web application for pitch detection and musical training built with Next.js and TypeScript.

## Features

- Real-time pitch detection using microphone input
- Visual feedback for pitch accuracy
- Interactive musical training exercises
- Modern, responsive user interface

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (version 20 or later)
- Package manager: either npm (comes with Node.js) or yarn
  ```bash
  # To install yarn globally (if you prefer yarn):
  npm install -g yarn
  ```
- A modern web browser with microphone support
- Git (for version control)

## Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd ptitch-perfect
   ```

2. Install dependencies:
   ```bash
   # Using npm
   npm install

   # Using yarn
   yarn install
   # or simply
   yarn
   ```

3. Create a `.env` file in the root directory if needed for environment variables

## Development

To run the development server:

```bash
# Using npm
npm run dev

# Using yarn
yarn dev
```

The application will be available at `http://localhost:3000`

## Building for Production

1. Create a production build:
   ```bash
   # Using npm
   npm run build

   # Using yarn
   yarn build
   ```

2. Start the production server:
   ```bash
   # Using npm
   npm run start

   # Using yarn
   yarn start
   ```

## Available Scripts

Using npm:
- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run prettier` - Format code with Prettier
- `npm run prettier:check` - Check code formatting

Using yarn:
- `yarn dev` - Start development server
- `yarn build` - Create production build
- `yarn start` - Start production server
- `yarn lint` - Run ESLint
- `yarn prettier` - Format code with Prettier
- `yarn prettier:check` - Check code formatting

## Technology Stack

- **Framework:** Next.js 14
- **Language:** TypeScript 5
- **UI:** React 18
- **Styling:** TailwindCSS
- **Pitch Detection:** Pitchy library
- **Development Tools:**
  - ESLint
  - Prettier
  - Husky (Git hooks)

## Browser Support

The application requires a modern web browser with:
- WebAudio API support
- Microphone access capabilities
- JavaScript enabled


