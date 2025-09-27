import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { toast } from "sonner";

interface SidebarProps {
  selectedProjectId: Id<"projects"> | null;
  selectedChatId: Id<"chats"> | null;
  onProjectSelect: (projectId: Id<"projects"> | null) => void;
  onChatSelect: (chatId: Id<"chats"> | null) => void;
}

export function Sidebar({ selectedProjectId, selectedChatId, onProjectSelect, onChatSelect }: SidebarProps) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newChatName, setNewChatName] = useState("");

  const projects = useQuery(api.projects.list);
  const chats = useQuery(api.chats.listByProject, selectedProjectId ? { projectId: selectedProjectId } : "skip");
  const selectedProject = useQuery(api.projects.get, selectedProjectId ? { id: selectedProjectId } : "skip");

  const createProject = useMutation(api.projects.create);
  const createChat = useMutation(api.chats.create);

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
        projectId: selectedProjectId 
      });
      setNewChatName("");
      setShowNewChat(false);
      onChatSelect(chatId);
      toast.success("Chat created successfully!");
    } catch (error) {
      toast.error("Failed to create chat");
    }
  };

  const handleBackToProjects = () => {
    onProjectSelect(null);
    onChatSelect(null);
  };

  if (selectedProjectId) {
    // Show chats in selected project
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <Button
            variant="ghost"
            onClick={handleBackToProjects}
            className="mb-3 p-2 hover:bg-gray-100 rounded-md flex items-center text-sm text-gray-600"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Projects
          </Button>
          <h2 className="font-semibold text-gray-900 truncate">{selectedProject?.name}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-700">Chats</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewChat(true)}
              className="text-blue-600 hover:text-blue-700"
            >
              + New Chat
            </Button>
          </div>

          {showNewChat && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <Input
                placeholder="Chat name"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                className="mb-2"
                onKeyDown={(e) => e.key === "Enter" && handleCreateChat()}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateChat}>Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewChat(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {chats?.map((chat) => (
              <button
                key={chat._id}
                onClick={() => onChatSelect(chat._id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedChatId === chat._id
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <div className="font-medium truncate">{chat.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(chat._creationTime).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show projects list
  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Projects</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewProject(true)}
            className="text-blue-600 hover:text-blue-700"
          >
            + New Project
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {showNewProject && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <Input
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="mb-2"
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateProject}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewProject(false)}>Cancel</Button>
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
              <div className="font-medium text-gray-900 truncate">{project.name}</div>
              {project.description && (
                <div className="text-sm text-gray-600 mt-1 truncate">{project.description}</div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {new Date(project._creationTime).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
