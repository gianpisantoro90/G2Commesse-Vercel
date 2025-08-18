# G2 Ingegneria - Sistema Gestione Commesse

## Overview

**Complete System Update (August 18, 2025)**
- ✅ **LUNGO TEMPLATE FIX**: Fixed folder structure creation using authentic G2 template (1_CONSEGNA, 2_PERMIT, 3_PROGETTO, etc.)
- ✅ **PORT CONFIGURATION FIX**: Resolved localhost:5000 vs localhost:3000 mismatch in G2-START.bat  
- ✅ **AUTO-ROUTING IMPROVEMENTS**: Fixed file moving functionality to actually move files instead of downloading
- ✅ **RECURSIVE SCANNING**: Enhanced bulk rename to scan all subdirectories recursively
- ✅ **FILE SYSTEM API**: Implemented proper file moving with File System Access API and fallback
- ✅ **BROWSER AUTO-LAUNCH**: G2-START.bat now opens browser automatically on correct port
- ✅ **UPDATED TEMPLATES**: LUNGO template expanded with 10 complete sections based on ZIP reference
- ✅ **PROJECT STATUS MANAGEMENT**: Added status field (In Corso, Conclusa, Sospesa) with colored badges
- ✅ **FIXED AUTO-ROUTING**: Critical file routing bug resolved - original files now preserved correctly instead of creating TXT files
- ✅ **STATUS SYNCHRONIZATION**: Fixed dashboard "Commesse Recenti" to show actual database status instead of date-based logic
- ✅ **EDIT FUNCTIONALITY**: Added complete edit form for projects in Gestione tab with working update functionality
- ✅ **G2 FOLDER TEMPLATES**: Updated both LUNGO and BREVE templates with authentic G2 Ingegneria folder structures from ZIP file
- Updated schema with status field and pushed to database
- Enhanced project table with status display column
- Improved routing results component to maintain original file formats
- Template structure now includes comprehensive engineering workflow sections
- Fixed G2-START.bat to dynamically detect and use correct PORT environment variable
- Auto-routing now uses File System Access API to actually move files to destination folders
- Recursive file scanning includes all subdirectories in bulk rename operations

**Data Persistence & Local Startup Fix (August 17, 2025)**
- Fixed critical issue where project list disappeared in local version
- Implemented FileStorage class for persistent local data storage using JSON files
- Projects and clients now persist between application restarts
- Created `server/storage-local.ts` with file-based storage implementation
- Added proper storage initialization logic with fallback to memory storage
- Updated project code generation to include city references (YY+CLIENT+CITY+NN format)
- Fixed bulk file renaming component error (`selectedFiles` undefined)
- **FIXED**: Local startup script that was closing immediately
- Created multiple startup options: `AVVIA-G2-LOCALE.bat`, `start-local-simple.bat`, `start-local.cmd`
- Added comprehensive error handling and user feedback in startup scripts
- Cleaned up unnecessary files and improved project structure

G2 Ingegneria is a project management system designed for engineering firms to manage "commesse" (projects/jobs). The application provides a comprehensive dashboard for creating, organizing, and tracking engineering projects with intelligent file routing capabilities. It features a modern web interface with persistent local data storage, AI-powered file organization suggestions, and support for different project templates (LUNGO and BREVE) based on project complexity.

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
- **Local Development**: File-based JSON storage in `data/` directory for persistent local data
- **Development Fallback**: In-memory storage when other options fail
- **File Operations**: Real file routing with download fallback and File System API integration
- **Data Retention**: All projects, clients, and routing decisions are permanently stored
- **Local Persistence**: FileStorage class saves data to JSON files for local development

### AI Integration
- **File Router**: Intelligent file placement suggestions using Claude AI API
- **Learning System**: Pattern recognition for improving routing accuracy over time
- **Confidence Scoring**: 0-100 scale for routing suggestion reliability
- **Multiple Methods**: AI, rules-based, and learned pattern routing approaches
- **Bulk File Operations**: Automated renaming of existing project files with proper prefixes

### Template System
- **LUNGO Template**: Authentic G2 Ingegneria folder structure with 10 main sections:
  - 1_CONSEGNA, 2_PERMIT, 3_PROGETTO (with ARC, CME, IE, IM, IS, STR, etc.)
  - 4_MATERIALE_RICEVUTO, 5_CANTIERE, 6_VERBALI_NOTIFICHE_COMUNICAZIONI
  - 7_SOPRALLUOGHI, 8_VARIANTI, 9_PARCELLA, 10_INCARICO
- **BREVE Template**: Simplified 4-folder structure: CONSEGNA, ELABORAZIONI, MATERIALE_RICEVUTO, SOPRALLUOGHI
- **Template Source**: Updated from official G2 Ingegneria ZIP file with authentic folder structures
- **Dynamic Generation**: Template-based folder creation with customizable structures
- **Reference Files**: Original templates stored in `/templates/` directory for maintenance

### File System Integration
- **Browser API**: File System Access API for direct folder manipulation
- **Auto-Routing**: Intelligent file placement based on content analysis
- **Folder Structure**: Automated creation of project-specific directory hierarchies
- **Bulk Folder Rename**: Automatic renaming of all files in selected directories with project code prefixes

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