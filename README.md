# Aivital - Comprehensive Health Tracking Application

A modern, full-stack health monitoring application built with Vue 3, TypeScript, and Supabase. Track your health metrics, chat with an AI assistant, and gain insights through comprehensive analytics.

![Vue 3](https://img.shields.io/badge/Vue-3.4.38-4FC08D?style=flat&logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178C6?style=flat&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-2.45.4-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.10-38B2AC?style=flat&logo=tailwind-css&logoColor=white)

## 🌟 Features

### 🔐 Authentication & Security
- Secure email/password authentication
- Row-level security (RLS) policies
- Profile management with privacy controls
- Password reset functionality

### 📊 Health Monitoring
- Track multiple health metrics (blood pressure, weight, heart rate, etc.)
- Real-time data input with validation
- Historical data visualization
- Customizable metric types and units

### 💬 AI Health Assistant
- Interactive chat interface
- Context-aware health advice
- Message history persistence
- Privacy-focused conversations

### 📈 Analytics Dashboard
- Comprehensive health trends
- Interactive charts and insights
- Data export capabilities
- Personalized health recommendations

### 🎨 Modern UI/UX
- Responsive design for all devices
- Clean, intuitive interface
- Smooth animations and transitions
- Accessibility-focused components

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier available)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd aivital
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. **Create a Supabase Project:**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose your organization and create the project

2. **Get Your Project Credentials:**
   - Go to Settings → API
   - Copy your Project URL and anon public key

3. **Configure Environment Variables:**
   - Copy `.env.example` to `.env`
   - Update with your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set Up Database

The database migrations are already included in the `supabase/migrations` folder. To apply them:

1. **Install Supabase CLI** (optional, for advanced usage):
```bash
npm install -g supabase
```

2. **Apply Migrations:**
   - The migrations will be automatically applied when you connect to Supabase
   - Alternatively, you can run the SQL files manually in your Supabase SQL editor

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 📁 Project Structure

```
src/
├── components/          # Reusable Vue components
│   └── shared/         # Shared components (navigation, etc.)
├── pages/              # Page components
│   ├── AuthPage.vue    # Authentication
│   ├── DashboardPage.vue # Main dashboard
│   ├── HealthPage.vue  # Health metrics
│   ├── ChatPage.vue    # AI chat interface
│   ├── AnalyticsPage.vue # Analytics dashboard
│   └── ProfilePage.vue # User profile
├── stores/             # Pinia state management
│   ├── auth.ts         # Authentication store
│   ├── health.ts       # Health metrics store
│   └── chat.ts         # Chat store
├── services/           # External service integrations
│   └── supabase.ts     # Supabase client
├── types/              # TypeScript type definitions
│   ├── index.ts        # Main types
│   └── database.ts     # Database types
├── router/             # Vue Router configuration
└── style.css          # Global styles
```

## 🗄️ Database Schema

The application uses the following main tables:

- **`user_profiles`** - User information and preferences
- **`health_metrics`** - Health measurement data
- **`chat_messages`** - Chat conversation history
- **`analytics_data`** - Aggregated analytics data

All tables include Row-Level Security (RLS) policies to ensure users can only access their own data.

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build

# Testing
npm run test            # Run unit tests
npm run test:ui         # Run tests with UI

# Code Quality
npm run lint            # Lint code
npm run type-check      # TypeScript type checking
```

## 🎯 Usage Guide

### Getting Started

1. **Sign Up:** Create a new account using your email
2. **Complete Profile:** Add your basic health information
3. **Add Metrics:** Start tracking your health data
4. **Explore Chat:** Ask the AI assistant health-related questions
5. **View Analytics:** Check your health trends and insights

### Adding Health Metrics

1. Navigate to the Health page
2. Click "Add Metric"
3. Select metric type (blood pressure, weight, etc.)
4. Enter your measurement
5. Add optional notes
6. Save the metric

### Using the AI Chat

1. Go to the Chat page
2. Type your health-related question
3. Get personalized advice and insights
4. View your conversation history

### Viewing Analytics

1. Visit the Analytics page
2. Select time ranges and metric types
3. View trends and patterns
4. Export data if needed

## 🔒 Security Features

- **Authentication:** Secure email/password with Supabase Auth
- **Authorization:** Row-Level Security ensures data isolation
- **Data Privacy:** Configurable privacy settings
- **Secure Communication:** All data encrypted in transit
- **Input Validation:** Client and server-side validation

## 🎨 Customization

### Themes and Styling

The application uses Tailwind CSS with a custom color palette. You can customize:

- **Colors:** Edit `tailwind.config.js`
- **Components:** Modify component styles in `src/style.css`
- **Layout:** Adjust responsive breakpoints

### Adding New Metric Types

1. Update the `MetricType` in `src/types/index.ts`
2. Add the new type to the database constraint in migrations
3. Update the UI components to handle the new type

## 🚀 Deployment

### Netlify (Recommended)

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist` folder to Netlify

### Other Platforms

The application can be deployed to any static hosting service:
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
- Firebase Hosting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues:

1. Check the [Issues](../../issues) page
2. Review the troubleshooting section below
3. Create a new issue with detailed information

## 🔧 Troubleshooting

### Common Issues

**Environment Variables Not Loading:**
- Ensure `.env` file is in the root directory
- Restart the development server after changes
- Check that variable names start with `VITE_`

**Database Connection Issues:**
- Verify Supabase URL and key are correct
- Check that RLS policies are properly configured
- Ensure migrations have been applied

**Build Errors:**
- Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Check TypeScript errors: `npm run type-check`

**Authentication Problems:**
- Verify Supabase Auth settings
- Check email confirmation settings
- Ensure RLS policies allow user operations

## 🔮 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics with ML insights
- [ ] Integration with wearable devices
- [ ] Telemedicine features
- [ ] Multi-language support
- [ ] Dark mode theme

## 📊 Tech Stack

- **Frontend:** Vue 3, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **State Management:** Pinia
- **Routing:** Vue Router
- **Charts:** Chart.js
- **Testing:** Vitest
- **Build Tool:** Vite
- **Deployment:** Netlify

---

Built with ❤️ using modern web technologies for a healthier future.