# G2 Ingegneria - Sistema Gestione Commesse

## Overview

G2 Ingegneria is a project management system designed for engineering firms to manage "commesse" (projects/jobs). The application provides a comprehensive dashboard for creating, organizing, and tracking engineering projects with intelligent file routing capabilities. It features a modern web interface with local data storage, AI-powered file organization suggestions, and support for different project templates (LUNGO and BREVE) based on project complexity.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite for build tooling
- **UI Components**: Shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom G2 Ingegneria color scheme and theming
- **State Management**: React Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling

### Backend Architecture
- **Runtime**: Node.js with Express.js REST API
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Data Storage**: In-memory storage implementation with interface for future database integration
- **File Processing**: Local file system integration with File System Access API
- **API Structure**: RESTful endpoints for projects, clients, file routings, and system configuration

### Data Models
- **Projects**: Core entity with code, client, location, description, year, and template type
- **Clients**: Client registry with unique sigla (code) and project count tracking
- **File Routings**: AI-powered file organization suggestions with confidence scoring and actual file movement tracking
- **System Config**: Application settings and configuration storage

### Data Persistence Strategy
- **Production Database**: PostgreSQL with Neon serverless hosting for persistent data storage
- **Development Fallback**: In-memory storage when DATABASE_URL is not available
- **File Operations**: Real file routing with download fallback and File System API integration
- **Data Retention**: All projects, clients, and routing decisions are permanently stored

### AI Integration
- **File Router**: Intelligent file placement suggestions using Claude AI API
- **Learning System**: Pattern recognition for improving routing accuracy over time
- **Confidence Scoring**: 0-100 scale for routing suggestion reliability
- **Multiple Methods**: AI, rules-based, and learned pattern routing approaches
- **Bulk File Operations**: Automated renaming of existing project files with proper prefixes

### Template System
- **LUNGO Template**: Comprehensive folder structure for complex engineering projects
- **BREVE Template**: Simplified structure for smaller projects
- **Dynamic Generation**: Template-based folder creation with customizable structures

### File System Integration
- **Browser API**: File System Access API for direct folder manipulation
- **Auto-Routing**: Intelligent file placement based on content analysis
- **Folder Structure**: Automated creation of project-specific directory hierarchies

## External Dependencies

### Core Technologies
- **Database**: PostgreSQL with Neon serverless hosting support
- **Build Tools**: Vite with React plugin and TypeScript support
- **Development**: tsx for TypeScript execution, esbuild for production builds

### UI Framework
- **React Query**: Data fetching and caching layer
- **Radix UI**: Comprehensive set of UI primitives (dialogs, dropdowns, forms, etc.)
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Lucide React**: Icon library for consistent iconography

### Data Management
- **Drizzle ORM**: Type-safe database ORM with migration support
- **Zod**: Runtime type validation and schema definition
- **React Hook Form**: Form state management with validation

### AI Services
- **Claude AI API**: Anthropic's language model for intelligent file routing
- **Content Analysis**: File type detection and categorization

### Development Tools
- **TypeScript**: Static type checking and enhanced developer experience
- **PostCSS**: CSS processing with Tailwind integration
- **ESLint**: Code quality and style enforcement

### Browser APIs
- **File System Access API**: Direct file system manipulation in supported browsers
- **IndexedDB**: Client-side database for offline data storage
- **Local Storage**: Simple key-value storage for configuration

### Replit Integration
- **Cartographer**: Development-time code exploration and visualization
- **Runtime Error Modal**: Enhanced error handling in development environment
- **Development Banner**: Environment awareness for proper context