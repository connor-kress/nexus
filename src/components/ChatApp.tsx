import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
import { useNotes, useNoteUpdates } from "./NodeSummary/hooks/useNotes";
import React from "react";
import { NexusLogo } from "./NexusLogo";

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
  const [selectedNoteId, setSelectedNoteId] = useState<Id<"notes"> | null>(
    null
  );
  const user = useQuery(api.auth.loggedInUser);
  const leaveAll = useMutation(api.chats.leaveAll);

  React.useEffect(() => {
    const ran = { current: false } as { current: boolean };
    if (ran.current) return;
    ran.current = true;
    leaveAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasProject = !!selectedProjectId;

  return (
    <div className="h-screen bg-gray-100">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full min-h-0 overflow-hidden"
      >
        {/* LEFT: Sidebar */}
        <ResizablePanel
          defaultSize={22}
          minSize={16}
          maxSize={30}
          className="border-r bg-white min-h-0 overflow-hidden"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <NexusLogo size={32} pulse wordmark textSize="text-3xl" />
              <SignOutButton />
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <Sidebar
                selectedProjectId={selectedProjectId}
                selectedChatId={selectedChatId}
                onProjectSelect={(p) => {
                  setSelectedProjectId(p);
                  setSelectedNoteId(null);
                }}
                onChatSelect={setSelectedChatId}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* MIDDLE: Chat / Empty state */}
        <ResizablePanel
          defaultSize={hasProject ? 52 : 78}
          minSize={35}
          className="bg-gray-50 min-h-0 overflow-hidden"
        >
          <div className="h-full">
            {selectedChatId ? (
              <ChatInterface chatId={selectedChatId} />
            ) : (
              <EmptyChat email={user?.email ?? null} />
            )}
          </div>
        </ResizablePanel>

        {/* RIGHT: Graph + Summaries — render ONLY when project is selected */}
        {hasProject && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize={26}
              minSize={20}
              className="border-l bg-gray-50 min-h-0 overflow-hidden"
            >
              <ResizablePanelGroup
                direction="vertical"
                className="h-full min-h-0 overflow-hidden"
              >
                <ResizablePanel
                  defaultSize={60}
                  minSize={30}
                  className="border-b bg-gray-50 min-h-0 overflow-hidden"
                >
                  <div className="h-full overflow-hidden">
                    <GraphPanel
                      projectId={selectedProjectId!}
                      onSelectNote={setSelectedNoteId}
                    />
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel
                  defaultSize={40}
                  minSize={25}
                  className="bg-gray-50 min-h-0 overflow-hidden"
                >
                  <div className="h-full overflow-hidden">
                    <NotesSection
                      projectId={selectedProjectId!}
                      selectedNoteId={selectedNoteId}
                      onClear={() => setSelectedNoteId(null)}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}

function NotesSection({
  projectId,
  selectedNoteId,
  onClear,
}: {
  projectId: Id<"projects">;
  selectedNoteId: Id<"notes"> | null;
  onClear: () => void;
}) {
  const { notes } = useNotes(projectId);
  const { updates } = useNoteUpdates(projectId);
  const applyUpdate = useMutation(api.notes.applyUpdate);
  const rejectUpdate = useMutation(api.notes.rejectUpdate);

  const proposedNodes = useMemo(
    () =>
      (updates ?? []).map(
        (u: {
          _id: Id<"noteUpdates">;
          _creationTime: number;
          type: "create" | "update" | "delete";
          title: string;
          match: string;
          body: string;
        }) => ({
          id: String(u._id),
          title: u.title || u.match || "(untitled)",
          summary: u.body,
          createdAt: new Date(u._creationTime),
          tokens: 0,
          updateType: u.type,
        })
      ),
    [updates]
  );

  const acceptedNodes = useMemo(
    () =>
      (notes ?? []).map(
        (n: {
          _id: Id<"notes">;
          title: string;
          body: string;
          _creationTime: number;
        }) => ({
          id: String(n._id),
          title: n.title,
          summary: n.body,
          createdAt: new Date(n._creationTime),
          tokens: 0,
        })
      ),
    [notes]
  );

  const handleSaveOne = async (id: string) => {
    // id refers to the proposed node id, which is the noteUpdates _id
    await applyUpdate({ updateId: id as unknown as Id<"noteUpdates"> });
  };
  const handleRejectOne = async (id: string) => {
    await rejectUpdate({ updateId: id as unknown as Id<"noteUpdates"> });
  };
  const handleSaveMany = async (ids: string[]) => {
    for (const id of ids) {
      await applyUpdate({ updateId: id as unknown as Id<"noteUpdates"> });
    }
  };

  return (
    <NodeSummaryPanel
      projectId={projectId}
      proposedNodes={proposedNodes}
      acceptedNodes={acceptedNodes}
      onSaveOne={handleSaveOne}
      onRejectOne={handleRejectOne}
      onSaveMany={handleSaveMany}
      selectedNoteId={selectedNoteId}
      onClear={onClear}
    />
  );
}
