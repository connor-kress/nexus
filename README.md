# Nexus

Nexus is an AI-powered collaborative workspace designed to help teams organize conversations, notes, and knowledge graphs in one place. It integrates real-time chat, graph visualization, AI-generated summaries, and project management tools into a seamless experience.

## Features

- **Project & Chat Management**  
  - Create and manage multiple projects  
  - Real-time chat within projects  
  - Loading indicators and notifications  

- **AI-Powered Assistance**  
  - Summarize chats into structured notes  
  - Generate knowledge graphs of related ideas  
  - Markdown rendering with GitHub Flavored Markdown (GFM)  

- **Graph Visualization**  
  - Interactive graph panel powered by Sigma.js and ForceAtlas2  
  - Hover tooltips and note selection  
  - Future-ready for summarization + semantic linking  

- **Collaboration**  
  - Project membership with avatar stacks  
  - Collapsible member lists  
  - Role-based permissions (planned)  

- **Notifications & UI Polish**  
  - Notification dropdown with emphasis for unread items  
  - Sidebar with project/chat switching  
  - Spinning loader next to chat titles  

## Tech Stack

- **Frontend**: React + TypeScript + TailwindCSS 
- **Backend / DB**: [Convex](https://convex.dev) for real-time data & actions syncing 
- **Graph Rendering**: [Sigma.js](https://github.com/jacomyal/sigma.js), [Graphology](https://github.com/graphology/graphology), ForceAtlas2 layout  
- **Markdown Support**: React Markdown + remark-gfm  
- **UI Components**: Custom + shadcn/ui + Lucide Icons  
- **Notifications**: Sonner (toast system)  

## Getting Started

### Prerequisites
- Node.js 18+
- Convex CLI (`npm install -g convex`)
- A Convex project set up (`npx convex dev`)

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/nexus.git
cd nexus

# Install dependencies
npm install

# Run Convex backend
npx convex dev

# Run frontend
npm run dev
```

### Initial Setup

First, create an empty `.env.local` file in the project root directory and run the following to link a Convex account.

```bash
npm run dev
```

**Note:** When prompted, choose to use a remote Convex account and login or signup in your browser.

Then, run the following:

```bash
node ./scripts/generateKeys.mjs
```

and copy the resulting `JWT_PRIVATE_KEY` and `JWKS` environmental variables into your convex dashboard under Settings > Environmental Variables.

Finally, obtain an `OPENROUTER_API_URL` token from the OpenRouter dashboard and paste it into the Convex dashboard as well.


## Roadmap

- [ ] Role-based access control for projects
- [ ] Cross-project graph linking
- [ ] Export chats/notes as PDF or Markdown
- [ ] Mobile-friendly interface

## Contributing

Contributions are welcome! Please open an issue or submit a PR for discussion.  

## License

MIT License © 2025 Nexus Team
