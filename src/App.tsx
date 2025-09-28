import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { ChatApp } from "./components/ChatApp";
import { NexusLogo } from "./components/NexusLogo";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Toaster />
      <Authenticated>
        <ChatApp />
      </Authenticated>
      <Unauthenticated>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-full max-w-md mx-auto p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                <NexusLogo size={32} pulse wordmark textSize="text-3xl" />
              </h1>
              <p className="text-gray-600">
                Sign in to organize your AI conversations by projects
              </p>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}
