# NexRev Project Architecture

This diagram visualizes the structure and relationships within the NexRev project.

```mermaid
graph TD
    Root["/root/NexRev"]
    
    Root --> Backend["backend/"]
    Root --> Frontend["frontend/"]
    Root --> Scripts["scripts/"]
    Root --> Nginx["nginx/"]
    Root --> Docs["docs/"]
    Root --> Github[".github/"]
    
    subgraph "Release Process"
        Scripts --> Release["release.mjs"]
        Scripts --> Sync["sync-version.mjs"]
        Release --> Sync
        Sync --> BackendPkg["backend/package.json"]
        Sync --> FrontendPkg["frontend/package.json"]
        Sync --> Env[".env.example"]
        VERSION["VERSION file"] --> Release
    end
    
    subgraph "Backend Structure"
        Backend --> BackendSrc["src/"]
        Backend --> BackendTest["test/"]
        Backend --> BackendData["data/"]
        Backend --> BackendScripts["scripts/"]
    end
    
    subgraph "Frontend Structure"
        Frontend --> FrontendSrc["src/"]
        Frontend --> FrontendPublic["public/"]
        Frontend --> ViteConfig["vite.config.ts"]
    end
    
    subgraph "Infrastructure"
        Docker["docker-compose.yml"] --> Backend
        Docker --> Frontend
        Docker --> Nginx
    end
```

## Component Overview

- **Backend**: Node.js/TypeScript application handling data and API logic.
- **Frontend**: Vite-powered TypeScript application for the user interface.
- **Scripts**: Maintenance and utility scripts, including the version release workflow.
- **Nginx**: Web server configuration for routing and serving the applications.
- **Docs**: Project documentation and architecture details.
- **Infrastructure**: Containerized setup using Docker and Docker Compose.
