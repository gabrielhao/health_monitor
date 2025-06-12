# Aivital - AI-Powered Health Monitoring & Data Import Platform

A comprehensive health tracking application with advanced data import capabilities, vector database integration, and AI-powered insights. Built with Vue 3, TypeScript, and Supabase.

![Vue 3](https://img.shields.io/badge/Vue-3.4.38-4FC08D?style=flat&logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178C6?style=flat&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-2.45.4-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.10-38B2AC?style=flat&logo=tailwind-css&logoColor=white)

## 🌟 Key Features

### 🔐 **Secure Authentication & Privacy**
- Email/password authentication with Supabase Auth
- Row-level security (RLS) for complete data isolation
- Comprehensive privacy controls and settings
- Secure password reset functionality

### 📊 **Advanced Health Monitoring**
- Track 11+ health metrics (blood pressure, heart rate, weight, sleep, etc.)
- Real-time data visualization and trends
- Custom metric types with flexible units
- Historical data analysis and insights

### 🤖 **AI Health Assistant**
- Context-aware health conversations
- Personalized advice based on your data
- RAG (Retrieval-Augmented Generation) powered responses
- Secure, privacy-focused AI interactions

### 📈 **Comprehensive Analytics**
- Interactive health trend visualizations
- Personalized health insights and recommendations
- Data export capabilities (CSV, PDF)
- Advanced pattern recognition

### 📥 **Universal Data Import System**
- **Apple Health XML** - Full support for Apple Health exports
- **Google Fit** - Import fitness and health data
- **Fitbit** - Sync wearable device data
- **Garmin Connect** - Import training and health metrics
- **Manual Upload** - CSV, JSON, XML file support
- **Vector Database Storage** - All imported data becomes searchable

### 🔍 **Vector Database & RAG**
- **pgvector** integration for semantic search
- **Automatic embedding generation** for all health documents
- **Similarity search** across your entire health history
- **Context-aware AI responses** using your personal data

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** and npm
- **Supabase account** (free tier available)

### 1. Clone & Install
```bash
git clone <repository-url>
cd aivital
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_NAME=Aivital
VITE_APP_VERSION=1.0.0
```

### 3. Database Setup
The database migrations will automatically create:
- **User profiles** with health information
- **Health metrics** tracking system
- **Vector database** with pgvector extension
- **Import system** for external data
- **Chat system** with AI integration
- **Analytics** data aggregation

### 4. Start Development
```bash
npm run dev
```
Access the application at `http://localhost:5173`

## 🧪 Testing the Application

### Demo Account
For testing purposes, you can create a new account or use these sample credentials:

**Test Account:**
- Email: `demo@aivital.com`
- Password: `demo123456`

*Note: This is a demo account - create your own for personal use*

### Testing Data Import

#### 1. **Apple Health Export Testing**
1. Go to **Import Data** page (`/import`)
2. Select "Apple Health Export" as source
3. Click "Import Sample Data" to generate demo Apple Health data
4. Monitor the import progress in real-time
5. View imported data in the **Health** section

#### 2. **Manual File Upload**
1. Create a sample JSON file with health data:
```json
[
  {
    "type": "heart_rate",
    "value": 72,
    "unit": "bpm",
    "date": "2024-01-15T10:30:00Z",
    "source": "manual"
  }
]
```
2. Upload via the drag-and-drop interface
3. Select appropriate source type
4. Process and view results

#### 3. **Vector Search Testing**
1. Import sample data (as above)
2. Go to **Chat** page
3. Ask questions like:
   - "What was my average heart rate last week?"
   - "Show me my sleep patterns"
   - "How has my weight changed?"
4. The AI will use vector search to find relevant data

### Testing Features

#### Health Metrics
1. **Add Metrics**: Go to Health page → "Add Metric"
2. **Test Different Types**: Blood pressure, weight, heart rate, etc.
3. **View Trends**: Check dashboard for visualizations
4. **Edit/Delete**: Test metric management features

#### AI Chat
1. **Health Questions**: Ask about your metrics
2. **General Advice**: Request health tips
3. **Data Analysis**: Ask for pattern insights
4. **Context Awareness**: Notice how AI references your data

#### Analytics
1. **Time Ranges**: Test different date filters
2. **Metric Types**: Filter by specific health metrics
3. **Export Data**: Test CSV/PDF export functionality
4. **Insights**: Review AI-generated health insights

## 🗄️ Database Schema

### Core Tables
- **`user_profiles`** - User information and preferences
- **`health_metrics`** - Individual health measurements
- **`chat_messages`** - AI conversation history
- **`analytics_data`** - Aggregated health analytics

### Vector Database Tables
- **`health_documents`** - Imported health documents
- **`health_embeddings`** - Vector embeddings for RAG
- **`import_sessions`** - Import tracking and progress
- **`data_sources`** - Connected health app integrations

### Security
- **Row-Level Security (RLS)** on all tables
- **User isolation** - Users can only access their own data
- **Encrypted tokens** for external service connections

## 📁 Project Structure

```
src/
├── components/
│   └── shared/           # Reusable components
├── pages/
│   ├── AuthPage.vue      # Authentication
│   ├── DashboardPage.vue # Main dashboard
│   ├── HealthPage.vue    # Health metrics
│   ├── ChatPage.vue      # AI chat interface
│   ├── AnalyticsPage.vue # Analytics dashboard
│   ├── ProfilePage.vue   # User profile
│   └── DataImportPage.vue # Data import interface
├── stores/
│   ├── auth.ts           # Authentication state
│   ├── health.ts         # Health metrics state
│   ├── chat.ts           # Chat state
│   └── vector.ts         # Vector database state
├── services/
│   ├── supabase.ts       # Supabase client
│   └── vectorService.ts  # Vector operations
├── types/
│   ├── index.ts          # Core types
│   ├── database.ts       # Database types
│   └── vector.ts         # Vector database types
└── router/               # Vue Router configuration

supabase/
├── migrations/           # Database migrations
└── functions/            # Edge functions
    └── generate-embeddings/ # Vector embedding generation
```

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

## 🎯 How to Use Aivital

### Getting Started
1. **Sign Up**: Create account with email/password
2. **Complete Profile**: Add basic health information
3. **Import Data**: Upload health data from other apps
4. **Start Tracking**: Add manual health metrics
5. **Chat with AI**: Ask health-related questions
6. **Analyze Trends**: View comprehensive analytics

### Data Import Workflow
1. **Choose Source**: Select Apple Health, Google Fit, etc.
2. **Upload File**: Drag & drop or select files
3. **Monitor Progress**: Track import status in real-time
4. **Review Results**: Check imported data and any errors
5. **Vector Processing**: Data automatically becomes searchable

### AI Chat Features
- **Personal Data Context**: AI knows your health history
- **Smart Recommendations**: Personalized health advice
- **Pattern Recognition**: Identifies trends in your data
- **Privacy-First**: All conversations are private and secure

## 🔒 Security & Privacy

### Data Protection
- **End-to-end encryption** for all data transmission
- **Row-level security** ensures complete data isolation
- **Privacy controls** - Configure what data is shared
- **Secure authentication** with Supabase Auth
- **GDPR compliant** data handling

### Vector Database Security
- **User-scoped embeddings** - Only your data in your vectors
- **Encrypted storage** for all health documents
- **Secure similarity search** with access controls
- **Audit logging** for all data operations

## 🚀 Deployment

### Environment Variables
```env
# Required
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional
VITE_APP_NAME=Aivital
VITE_ENABLE_CHAT=true
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_FILE_UPLOAD=true
```

### Build & Deploy
```bash
npm run build
# Deploy dist/ folder to your hosting platform
```

**Recommended Platforms:**
- Netlify (with automatic deployments)
- Vercel
- AWS S3 + CloudFront
- Firebase Hosting

## 🔧 Troubleshooting

### Common Issues

**Import Failures:**
- Check file format (XML, JSON, CSV supported)
- Verify file size (max 50MB)
- Ensure proper source selection
- Review error logs in import history

**Vector Search Not Working:**
- Verify pgvector extension is enabled
- Check embedding generation function
- Ensure sufficient imported data
- Review database permissions

**Authentication Problems:**
- Verify Supabase credentials in `.env`
- Check RLS policies are properly configured
- Ensure email confirmation settings
- Review browser console for errors

**Performance Issues:**
- Clear browser cache and localStorage
- Check network connectivity
- Verify database indexes are created
- Monitor Supabase usage limits

### Getting Help
1. Check the [Issues](../../issues) page
2. Review error logs in browser console
3. Check Supabase dashboard for database errors
4. Create detailed issue reports with steps to reproduce

## 🔮 Roadmap

### Upcoming Features
- [ ] **Mobile App** (React Native)
- [ ] **Advanced ML Insights** with predictive analytics
- [ ] **Wearable Device Integration** (direct API connections)
- [ ] **Telemedicine Features** (doctor sharing, appointments)
- [ ] **Multi-language Support**
- [ ] **Dark Mode Theme**
- [ ] **Real-time Sync** across devices
- [ ] **Advanced Visualizations** (3D charts, interactive graphs)

### Vector Database Enhancements
- [ ] **Semantic Health Search** across all user data
- [ ] **Cross-user Insights** (anonymized population health)
- [ ] **Predictive Health Modeling** using vector similarity
- [ ] **Advanced RAG Features** with health knowledge base

## 📊 Tech Stack

### Frontend
- **Vue 3** with Composition API
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Pinia** for state management
- **Vue Router** for navigation

### Backend & Database
- **Supabase** (PostgreSQL + Auth + Storage)
- **pgvector** for vector operations
- **Row-Level Security** for data isolation
- **Edge Functions** for serverless processing

### AI & Vector Processing
- **Vector embeddings** for semantic search
- **RAG (Retrieval-Augmented Generation)**
- **Similarity search** with cosine distance
- **Automatic content chunking**

### Development Tools
- **Vite** for fast development
- **Vitest** for testing
- **ESLint** for code quality
- **TypeScript** for type checking

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Update documentation for API changes
- Ensure RLS policies for new database tables
- Test vector database operations thoroughly

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- 📧 Email: support@aivital.com
- 💬 GitHub Issues: [Create an issue](../../issues)
- 📖 Documentation: [Wiki](../../wiki)

---

**Built with ❤️ for a healthier future through AI-powered health monitoring.**

*Aivital combines the power of modern web technologies with advanced AI to create a comprehensive health tracking platform that grows with your needs.*