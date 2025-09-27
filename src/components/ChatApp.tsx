import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Sidebar } from "./Sidebar";
import { ChatInterface } from "./ChatInterface";
import { SignOutButton } from "../SignOutButton";
import GraphPanel from "./Graph";
import NodeSummaryPanel from "./NodeSummary";

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

function EmptyChat({ email }: { email?: string | null }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center text-gray-700">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-1">
          Welcome{email ? `, ${email}` : ""}!
        </h2>
        <p className="text-gray-500">
          Select a project and chat to get started, or create a new one.
        </p>
      </div>
    </div>
  );
}

export function ChatApp() {
  const [selectedProjectId, setSelectedProjectId] =
    useState<Id<"projects"> | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(
    null
  );
  const [selectedNoteId, setSelectedNoteId] = useState<Id<"notes"> | null>(null);
  const user = useQuery(api.auth.loggedInUser);

  //this is just mock data
  const proposedNodes = [
    {
      id: "n1",
      title: "Add project-scoped roles",
      summary:
        "Discussed why JWT role claims can’t be trusted. Proposed class-level role assignments.",
      createdAt: new Date(),
      tokens: 320,
    },
    {
      id: "n2",
      title: "UI Layout Split",
      summary:
        "Plan to split layout into Sidebar, Chat, Graph, NodeSummary with resizable panels.",
      createdAt: new Date(),
      tokens: 210,
    },
  ];

  const acceptedNodes = [
    {
      id: "n3",
      title: "Assignment Model Schema",
      summary:
        "Assignment includes Title, Description, Settings, LessonID, UserID.",
      createdAt: new Date(),
      tokens: 150,
    },
  ];

  // 🔹 Mock handlers
  const handleSaveOne = (id: string) => {
    console.log("Saved node:", id);
  };
  const handleRejectOne = (id: string) => {
    console.log("Rejected node:", id);
  };
  const handleSaveMany = (ids: string[]) => {
    console.log("Saved ALL:", ids);
  };

  return (
    <div className="h-screen bg-gray-100">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Sidebar */}
        <ResizablePanel
          defaultSize={22}
          minSize={16}
          maxSize={30}
          className="border-r bg-white"
        >
          <div className="flex h-full flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                AI Chat Organizer
              </h1>
              <SignOutButton />
            </div>
            <div className="flex-1 overflow-auto">
              <Sidebar
                selectedProjectId={selectedProjectId}
                selectedChatId={selectedChatId}
                onProjectSelect={setSelectedProjectId}
                onChatSelect={setSelectedChatId}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main Chat */}
        <ResizablePanel defaultSize={52} minSize={35} className="bg-gray-50">
          <div className="h-full">
            {selectedChatId ? (
              <ChatInterface chatId={selectedChatId} />
            ) : (
              <EmptyChat email={user?.email ?? null} />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Graph + Node Summary */}
        <ResizablePanel
          defaultSize={26}
          minSize={20}
          className="border-l bg-gray-50"
        >
          <ResizablePanelGroup direction="vertical" className="h-full">
            <ResizablePanel
              defaultSize={60}
              minSize={30}
              className="border-b bg-gray-50"
            >
              <GraphPanel projectId={selectedProjectId ?? undefined} onSelectNote={setSelectedNoteId} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize={40}
              minSize={25}
              className="bg-gray-50"
            >
              <NodeSummaryPanel
                proposedNodes={proposedNodes}
                acceptedNodes={acceptedNodes}
                onSaveOne={handleSaveOne}
                onRejectOne={handleRejectOne}
                onSaveMany={handleSaveMany}
                selectedNoteId={selectedNoteId ?? undefined}
                onClear={() => setSelectedNoteId(null)}
              />
              
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
