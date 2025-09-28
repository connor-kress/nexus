import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MemberCollapse } from "./MemberCollapse";
import { ChatAvatarStack } from "./ChatAvatarStack";

interface SidebarProps {
  selectedProjectId: Id<"projects"> | null;
  selectedChatId: Id<"chats"> | null;
  onProjectSelect: (projectId: Id<"projects"> | null) => void;
  onChatSelect: (chatId: Id<"chats"> | null) => void;
}

export function Sidebar({
  selectedProjectId,
  selectedChatId,
  onProjectSelect,
  onChatSelect,
}: SidebarProps) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const projects = useQuery(api.projects.list);
  const chats = useQuery(
    api.chats.listByProject,
    selectedProjectId ? { projectId: selectedProjectId } : "skip"
  );
  const selectedProject = useQuery(
    api.projects.get,
    selectedProjectId ? { id: selectedProjectId } : "skip"
  );

  const joinChat = useMutation(api.chats.join);
  const leaveChat = useMutation(api.chats.leave);

  function handleSelectChat(nextId: Id<"chats">) {
    // optimistically switch UI first
    const prev = selectedChatId;
    onChatSelect(nextId);

    // fire-and-forget mutations (no user-blocking)
    if (prev && prev !== nextId) {
      leaveChat({ chatId: prev }).catch(() => {});
    }
    joinChat({ chatId: nextId }).catch(() => {});
  }

  const myRole = useQuery(
    api.projects.membershipRole,
    selectedProjectId ? { id: selectedProjectId } : "skip"
  );
  const invitations = useQuery(
    api.projects.listInvitations,
    selectedProjectId ? { projectId: selectedProjectId } : "skip"
  );
  const myInvites = useQuery(api.projects.myInvitations);

  const createProject = useMutation(api.projects.create);
  const createChat = useMutation(api.chats.create);
  const inviteByEmail = useMutation(api.projects.inviteByEmail);
  const acceptInvitation = useMutation(api.projects.acceptInvitation);
  const rejectInvitation = useMutation(api.projects.rejectInvitation);

  const pendingInvites =
    myInvites?.filter((i) => (i.status ?? "pending") === "pending") ?? [];

  const hasNotifications = pendingInvites.length > 0;

  const notificationsOverlay = showNotifications
    ? createPortal(
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setShowNotifications(false)}
          />
          <div className="absolute left-4 bottom-4 w-80 bg-white border border-gray-200 rounded-lg shadow-lg">
            <div className="p-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-800">
                  Notifications
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-500 hover:text-white"
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="p-3 max-h-96 overflow-y-auto">
              <div className="text-xs font-medium text-gray-600 mb-2">
                Pending invitations
              </div>
              {pendingInvites.length > 0 ? (
                <div className="space-y-2">
                  {pendingInvites.map((inv) => (
                    <div key={inv._id} className="text-sm text-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="mr-2 truncate">
                          <span className="font-medium">{inv.projectName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await acceptInvitation({
                                  invitationId: inv._id,
                                });
                                toast.success("Invitation accepted");
                              } catch (e) {
                                const message =
                                  (e as any)?.data?.error ??
                                  (e as Error).message ??
                                  "Failed to accept";
                                toast.error(message);
                              }
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await rejectInvitation({
                                  invitationId: inv._id,
                                });
                                toast.success("Invitation declined");
                              } catch (e) {
                                const message =
                                  (e as any)?.data?.error ??
                                  (e as Error).message ??
                                  "Failed to decline";
                                toast.error(message);
                              }
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">No notifications</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      const projectId = await createProject({ name: newProjectName.trim() });
      setNewProjectName("");
      setShowNewProject(false);
      onProjectSelect(projectId);
      toast.success("Project created successfully!");
    } catch (error) {
      toast.error("Failed to create project");
    }
  };

  const handleCreateChat = async () => {
    if (!newChatName.trim() || !selectedProjectId) return;

    try {
      const chatId = await createChat({
        name: newChatName.trim(),
        projectId: selectedProjectId,
      });
      setNewChatName("");
      setShowNewChat(false);
      onChatSelect(chatId);
      toast.success("Chat created successfully!");
    } catch (error) {
      toast.error("Failed to create chat");
    }
  };

  const handleInvite = async () => {
    if (!selectedProjectId) return;
    const email = inviteEmail.trim();
    if (!email) {
      toast.error("Please enter an email address.");
      return;
    }
    const emailPattern =
      /^(?:[a-zA-Z0-9_'^&\-]+(?:\.[a-zA-Z0-9_'^&\-]+)*|".+")@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    try {
      await inviteByEmail({ projectId: selectedProjectId, email });
      setInviteEmail("");
      setShowInvite(false);
      toast.success("Invitation sent");
    } catch (error) {
      const message =
        (error as any)?.data?.error ??
        (error as Error).message ??
        "Failed to send invitation";
      toast.error(message);
    }
  };

  const leaveAllInProject = useMutation(api.chats.leaveAllInProject);

  const handleBackToProjects = () => {
    if (selectedProjectId) {
      // fire-and-forget; keep UI snappy
      leaveAllInProject({ projectId: selectedProjectId }).catch(() => {});
    }
    onProjectSelect(null);
    onChatSelect(null);
  };

  if (selectedProjectId) {
    // Show chats in selected project
    return (
      <>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <Button
              variant="ghost"
              onClick={handleBackToProjects}
              className="mb-3 p-2 hover:bg-gray-100 rounded-md flex items-center text-sm text-gray-600"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Projects
            </Button>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 truncate">
                {selectedProject?.name}
              </h2>
              {myRole === "owner" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInvite((v) => !v)}
                  className="text-blue-600 hover:text-white"
                >
                  Invite
                </Button>
              )}
            </div>
            {showInvite && myRole === "owner" && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Invite member by email
                </div>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mb-2"
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  autoFocus
                />
                <div className="flex gap-2 items-center">
                  <Button
                    size="sm"
                    onClick={handleInvite}
                    className="text-white"
                  >
                    Send
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowInvite(false)}
                  >
                    Cancel
                  </Button>
                </div>
                {invitations && invitations.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1">
                      Invitations
                    </div>
                    <div className="space-y-1">
                      {invitations.map((inv) => (
                        <div
                          key={inv._id}
                          className="text-xs text-gray-600 flex items-center justify-between"
                        >
                          <span>{inv.userEmail}</span>
                          <span className="uppercase tracking-wide text-[10px] text-gray-400">
                            {inv.status ?? "pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {selectedProjectId && (
              <MemberCollapse
                projectId={selectedProjectId}
                myRole={(myRole as any) ?? null}
                onInviteClick={() => setShowInvite(true)}
                defaultOpen={true}
              />
            )}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium text-gray-700">Chats</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewChat(true)}
                className="text-blue-600  hover:text-white"
              >
                + New Chat
              </Button>
            </div>

            {showNewChat && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <Input
                  ref={(input) => {
                    if (input) input.focus();
                  }}
                  placeholder="Chat name"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="mb-2"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateChat()}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleCreateChat}
                    className="text-white"
                  >
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowNewChat(false)}
                    className="hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {chats?.map((chat) => (
                <button
                  key={chat._id}
                  onClick={() => handleSelectChat(chat._id)}
                  className={`w-full p-3 rounded-lg transition-colors ${
                    selectedChatId === chat._id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: name + date */}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{chat.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(chat._creationTime).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Right: tiny avatar stack */}
                    <ChatAvatarStack chatId={chat._id} max={4} />
                  </div>
                </button>
              ))}
            </div>
          </div>
          {/* Bottom bar with notifications */}
          <div className="p-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotifications((v) => !v)}
                className="text-gray-600 hover:text-white"
              >
                <span className="inline-flex items-center">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  Notifications
                </span>
              </Button>
            </div>
          </div>
        </div>
        {notificationsOverlay}
      </>
    );
  }

  // Show projects list
  return (
    <>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Projects</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewProject(true)}
              className="text-blue-600 hover:text-white"
            >
              + New Project
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {showNewProject && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <Input
                ref={(input) => {
                  if (input) input.focus();
                }}
                placeholder="Project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="mb-2"
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateProject}
                  className="text-white"
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNewProject(false)}
                  className="hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {projects?.map((project) => (
              <button
                key={project._id}
                onClick={() => onProjectSelect(project._id)}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900 truncate">
                  {project.name}
                </div>
                {project.description && (
                  <div className="text-sm text-gray-600 mt-1 truncate">
                    {project.description}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(project._creationTime).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>
        {/* Bottom bar with notifications */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotifications((v) => !v)}
              className={cn(
                "relative text-gray-600 hover:text-white transition",
                hasNotifications && "ring-2 ring-red-500/60 rounded-md"
              )}
              aria-label={
                hasNotifications
                  ? `Notifications (${pendingInvites.length})`
                  : "Notifications"
              }
            >
              <span className="inline-flex items-center">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                Notifications
              </span>

              {hasNotifications && (
                <>
                  <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 rounded-full bg-red-400 opacity-75 animate-ping" />
                  <span className="absolute -top-1 -right-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-medium">
                    {pendingInvites.length > 9 ? "9+" : pendingInvites.length}
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      {notificationsOverlay}
    </>
  );
}
