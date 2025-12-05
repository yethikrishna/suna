<div align="center">

# y0 - Open Source Generalist AI Agent

(that acts on your behalf)

![y0 Screenshot](frontend/public/banner.png)

y0 is a fully open source AI assistant that helps you accomplish real-world tasks with ease. Through natural conversation, y0 becomes your digital companion for research, data analysis, and everyday challenges—combining powerful capabilities with an intuitive interface that understands what you need and delivers results.

y0's powerful toolkit includes seamless web search and scraping capabilities, file management for document creation and editing, integration with various APIs and services, and automation workflows. These capabilities work together harmoniously, allowing y0 to solve your complex problems and automate tasks through simple conversations!

[![License](https://img.shields.io/badge/License-Apache--2.0-blue)](./LICENSE)

</div>

## Table of Contents

- [Architecture](#architecture)
  - [Next.js Application](#nextjs-application)
  - [Blink SDK Integration](#blink-sdk-integration)
- [Features](#features)
- [Getting Started](#getting-started)
- [License](#license)

## Architecture

y0 is built as a single Next.js application using the Blink SDK for serverless operations.

### Next.js Application

A modern web application built with Next.js 15, React, and TypeScript providing:
- Responsive chat interface
- Dashboard and agent management
- Real-time updates
- Server-side API routes

### Blink SDK Integration

y0 uses the Blink SDK for all backend operations:
- **Authentication**: User signup, login, and session management
- **Database**: Data persistence with automatic migrations
- **AI Capabilities**: Text generation, image generation, and transcription
- **Data Operations**: Web search, scraping, screenshots, and API proxy
- **Storage**: File upload and management
- **Realtime**: Live messaging and presence tracking
- **Notifications**: Email delivery and tracking
- **Analytics**: Automatic event tracking and user insights

## Features

### AI Capabilities
- **Web Search**: Real-time search with news, images, and shopping results
- **Web Scraping**: Extract content from websites with markdown conversion
- **Screenshots**: Capture website screenshots automatically
- **API Integration**: Connect to external services via secure proxy
- **Data Analysis**: Process and analyze various data formats

### Data Providers
- **LinkedIn**: Profile data, company information, job listings
- **Twitter**: User profiles, tweet analysis, trending topics
- **Amazon**: Product details, pricing, reviews, and market data
- **Yahoo Finance**: Stock prices, historical data, market analysis
- **Zillow**: Property information, real estate market data

### Platform Features
- **Authentication**: Email/password and social login support
- **Real-time Updates**: Live collaboration and presence tracking
- **File Management**: Upload, store, and manage files
- **Analytics**: User behavior tracking and insights
- **Email Notifications**: Automated email delivery
- **Background Jobs**: Scheduled task processing

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- A Blink project (get one at [blink.new](https://blink.new))
- Your `BLINK_PROJECT_ID` from the Blink dashboard

### Installation

1. **Clone the repository**:

```bash
git clone https://github.com/your-org/y0.git
cd y0
```

2. **Install dependencies**:

```bash
npm install
```

3. **Configure environment**:

Create a `.env.local` file with:

```env
NEXT_PUBLIC_BLINK_PROJECT_ID=your-project-id
NEXT_PUBLIC_BLINK_AUTH_MODE=headless
```

4. **Set up Blink secrets**:

In your Blink project dashboard, add any API keys you need:
- `RAPID_API_KEY` for LinkedIn, Twitter, Amazon, etc.

5. **Start the development server**:

```bash
npm run dev
```

6. **Open your browser** to [http://localhost:3000](http://localhost:3000)

### Production Deployment

Deploy y0 to any platform that supports Next.js:

- **Vercel**: Connect your repository and deploy with one click
- **Netlify**: Import your repository and configure build settings
- **Railway**: Deploy as a Node.js application
- **Docker**: Use the provided Dockerfile for container deployment

### Configuration

y0 is configured through environment variables and Blink project settings:

- Authentication providers are configured in your Blink project
- External API keys are stored as Blink secrets
- Database schema is managed automatically by Blink
- File storage and CDN are handled automatically

## License

y0 is licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for the full license text.
