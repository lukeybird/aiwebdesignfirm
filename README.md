# Advanced AI Web Design Firm - Landing Page

A modern, Apple-inspired landing page built with Next.js and React, showcasing fast turnarounds, high-quality work, and 15+ years of experience.

## Features

- **Modern Design**: Clean, minimalist, and bold design inspired by Apple's aesthetic
- **Responsive**: Fully responsive across all devices
- **Portfolio Showcase**: Grid layout with hover effects and preview buttons
- **Fast Performance**: Built with Next.js for optimal performance
- **TypeScript**: Fully typed for better development experience

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Customization

### Adding Portfolio Images

1. Place your project thumbnail images in the `public` folder
2. Update the `projects` array in `app/page.tsx` with your actual project data:

```typescript
const projects = [
  { id: 1, name: 'Project One', thumbnail: '/your-image.jpg' },
  // ... more projects
];
```

### Updating Contact Information

Update the call-to-action buttons to link to your contact form or email. Currently, they have placeholder `onClick` handlers that you can replace with your actual contact logic.

### Styling

The design uses Tailwind CSS. You can customize colors, fonts, and spacing in:
- `tailwind.config.ts` - Theme configuration
- `app/globals.css` - Global styles

## Project Structure

```
.
├── app/
│   ├── layout.tsx      # Root layout with metadata
│   ├── page.tsx        # Main landing page
│   └── globals.css     # Global styles
├── public/             # Static assets (add your images here)
├── package.json        # Dependencies
└── tailwind.config.ts  # Tailwind configuration
```

## Technologies

- **Next.js 14** - React framework
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

