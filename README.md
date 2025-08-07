# AskQL - AI-Powered SQL Assistant

<div align="center">

![AskQL Logo](https://img.shields.io/badge/AskQL-AI%20SQL%20Assistant-blue?style=for-the-badge&logo=sql)
![React](https://img.shields.io/badge/React-18.3.1-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.4.1-purple?style=for-the-badge&logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4.11-38B2AC?style=for-the-badge&logo=tailwind-css)

**Transform natural language into powerful SQL queries with AI assistance**

[Live Demo](#) • [Documentation](#) • [Report Bug](#) • [Request Feature](#)

</div>

---

## 🚀 Features

### 🤖 AI-Powered Chat Interface
- **Natural Language Processing**: Ask questions in plain English and get instant SQL queries
- **Intelligent Suggestions**: AI provides context-aware query suggestions
- **Real-time Responses**: Get immediate feedback and query results
- **Conversation History**: Track your query history and learn from past interactions

### 📊 Advanced Analytics Dashboard
- **Interactive Charts**: Visualize your data with beautiful, responsive charts
- **Real-time Analytics**: Monitor data performance with live dashboards
- **Custom Visualizations**: Create custom charts and graphs for your specific needs
- **Export Capabilities**: Export results in multiple formats (CSV, JSON, PDF)

### 🔗 Multiple Data Sources
- **Database Connections**: Connect to PostgreSQL, MySQL, SQLite, and more
- **File Upload Support**: Upload CSV, Excel, and JSON files for analysis
- **Cloud Storage**: Integrate with cloud storage solutions
- **Real-time Sync**: Keep your data sources synchronized

### 🛡️ Security & Privacy
- **Enterprise-grade Encryption**: Your data stays secure with advanced encryption
- **Privacy Controls**: Granular privacy settings for data access
- **User Authentication**: Secure login and user management
- **Audit Logs**: Track all data access and modifications

### 👥 Collaboration Features
- **Team Sharing**: Share queries and insights with your team
- **Query Libraries**: Build and share reusable query templates
- **Version Control**: Track changes to your queries and dashboards
- **Comments & Notes**: Add context to your queries and results

## 🛠️ Technology Stack

### Frontend
- **React 18.3.1** - Modern UI framework with hooks
- **TypeScript 5.5.3** - Type-safe development
- **Vite 5.4.1** - Fast build tool and dev server
- **React Router DOM 6.26.2** - Client-side routing
- **Tailwind CSS 3.4.11** - Utility-first CSS framework

### UI Components
- **shadcn/ui** - Beautiful, accessible component library
- **Radix UI** - Unstyled, accessible UI primitives
- **Lucide React** - Beautiful & consistent icon toolkit
- **Sonner** - Toast notifications
- **Recharts** - Composable charting library

### State Management & Data
- **TanStack Query** - Powerful data synchronization
- **React Hook Form** - Performant forms with easy validation
- **Zod** - TypeScript-first schema validation
- **Supabase** - Open source Firebase alternative

### Development Tools
- **ESLint** - Code linting and formatting
- **TypeScript ESLint** - TypeScript-specific linting rules
- **PostCSS & Autoprefixer** - CSS processing
- **Vite** - Fast development and building

## 📦 Installation

### Prerequisites
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** or **bun** - Package managers
- **Git** - Version control

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/gowtham3172004/askql.git
   cd askql
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your configuration:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   bun dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:5173](http://localhost:5173)

## 🚀 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run build:dev` | Build for development |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint for code quality |

## 📁 Project Structure

```
askql/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── ChatInterface.tsx
│   │   ├── DataSourcePanel.tsx
│   │   └── Navigation.tsx
│   ├── contexts/           # React contexts for state management
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # Third-party integrations
│   │   └── supabase/       # Supabase configuration
│   ├── lib/                # Utility functions
│   ├── pages/              # Application pages
│   └── main.tsx           # Application entry point
├── public/                 # Static assets
├── supabase/              # Supabase configuration
└── package.json           # Dependencies and scripts
```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Analytics
VITE_ANALYTICS_ID=your_analytics_id

# Optional: Feature Flags
VITE_ENABLE_BETA_FEATURES=false
```

### Database Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Run migrations**:
   ```bash
   npx supabase db push
   ```
3. **Set up authentication** in your Supabase dashboard
4. **Configure storage** for file uploads

## 🎯 Usage

### Getting Started

1. **Navigate to the Chatbot page**
   - Click "Start Chatting" on the homepage
   - Or go directly to `/chatbot`

2. **Connect your data source**
   - Upload CSV/Excel files
   - Connect to your database
   - Or use sample data for testing

3. **Ask questions in natural language**
   - "Show me all users who signed up last month"
   - "What's the average order value by category?"
   - "Find the top 10 customers by revenue"

4. **Review and execute queries**
   - AI generates SQL queries
   - Review and modify if needed
   - Execute to see results
   - Save queries for future use

### Advanced Features

- **Query History**: Access your previous queries and results
- **Dashboard**: Create custom dashboards with charts
- **Export Data**: Download results in various formats
- **Team Collaboration**: Share queries and insights

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- Follow the existing code style
- Use TypeScript for all new code
- Write meaningful commit messages
- Add tests for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **shadcn/ui** for the beautiful component library
- **Supabase** for the backend infrastructure
- **Vite** for the fast development experience
- **Tailwind CSS** for the utility-first styling
- **React Query** for efficient data fetching

## 📞 Support

- **Documentation**: [docs.askql.com](#)
- **Issues**: [GitHub Issues](https://github.com/gowtham3172004/askql/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gowtham3172004/askql/discussions)
- **Email**: support@askql.com

## 🔗 Links

- **Website**: [askql.com](#)
- **Documentation**: [docs.askql.com](#)
- **API Reference**: [api.askql.com](#)
- **Community**: [community.askql.com](#)

---

<div align="center">

**Made with ❤️ by the AskQL Team**

[![GitHub stars](https://img.shields.io/github/stars/gowtham3172004/askql?style=social)](https://github.com/gowtham3172004/askql)
[![GitHub forks](https://img.shields.io/github/forks/gowtham3172004/askql?style=social)](https://github.com/gowtham3172004/askql)
[![GitHub issues](https://img.shields.io/github/issues/gowtham3172004/askql)](https://github.com/gowtham3172004/askql/issues)

</div>
