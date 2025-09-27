import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Sidebar } from "./Sidebar";
import { ChatInterface } from "./ChatInterface";
import { SignOutButton } from "../SignOutButton";

export function ChatApp() {
  const [selectedProjectId, setSelectedProjectId] = useState<Id<"projects"> | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<Id<"chats"> | null>(null);
  const user = useQuery(api.auth.loggedInUser);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">AI Chat Organizer</h1>
          <SignOutButton />
        </div>
        <Sidebar
          selectedProjectId={selectedProjectId}
          selectedChatId={selectedChatId}
          onProjectSelect={setSelectedProjectId}
          onChatSelect={setSelectedChatId}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedChatId ? (
          <ChatInterface chatId={selectedChatId} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome, {user?.email}!</h2>
              <p className="text-gray-600">Select a project and chat to get started, or create a new one.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
