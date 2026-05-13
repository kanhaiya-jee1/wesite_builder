import React, { useRef, useEffect, useState } from "react";
import type { Message, Project, Version } from "../types";
import { BotIcon, EyeIcon, Loader2Icon, SendIcon } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/configs/axios";
import { toast } from "sonner";

interface SidebarProps {
  isMenuOpen: boolean;
  project: Project;
  setProject: (project: Project) => void;
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
}

const Sidebar = ({
  isMenuOpen,
  project,
  setProject,
  isGenerating,
  setIsGenerating,
}: SidebarProps) => {
  const messageRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");


  const handleRollback = async (versionId: string) => {
    try {
      setIsGenerating(true);
      await api.post(`/api/project/rollback/${project.id}/${versionId}`);
      const { data } = await api.get(`/api/user/project/${project.id}`);
      setProject(data.project);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevisions = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    try {
      setIsGenerating(true);

      await api.post(`/api/project/revision/${project.id}`, {
        message: input,
      });

      setInput("");

      const { data } = await api.get(`/api/user/project/${project.id}`);
      setProject(data.project);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message);
    } finally {
      setIsGenerating(false);
    }
  };


  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [project.conversation.length, isGenerating]);
 
  return (
    <div
      className={`h-full sm:max-w-sm rounded-xl bg-gray-900 border-gray-800 transition-all ${
        isMenuOpen ? "max-sm:w-0 overflow-hidden" : "w-full"
      }`}
    >
      <div className="flex flex-col h-full">
       
        <div className="flex-1 overflow-y-auto no-scrollbar px-3 flex flex-col gap-4">
          {[...project.conversation, ...project.versions]
            .sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            )
            .map((item) => {
              if ("content" in item) {
                const msg = item as Message;
                const isUser = msg.role === "user";

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                        <BotIcon className="size-5 text-white" />
                      </div>
                    )}

                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? "bg-indigo-600 text-white rounded-tr-none"
                          : "bg-gray-800 text-gray-100 rounded-tl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              }

              const ver = item as Version;
              return (
                <div
                  key={ver.id}
                  className="w-4/5 mx-auto my-2 p-3 rounded-xl bg-gray-800 text-gray-100"
                >
                  <div className="text-xs">
                    Code updated
                    <br />
                    <span className="text-gray-400">
                      {new Date(ver.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    {project.current_version_index === ver.id ? (
                      <button className="px-3 py-1 text-xs bg-gray-700 rounded">
                        Current version
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRollback(ver.id)}
                        className="px-3 py-1 text-xs bg-indigo-600 rounded"
                      >
                        Rollback
                      </button>
                    )}

                    <Link target="_blank" to={`/preview/${project.id}/${ver.id}`}>
                      <EyeIcon className="size-5 p-1 bg-gray-700 rounded" />
                    </Link>
                  </div>
                </div>
              );
            })}

          {isGenerating && (
            <div className="flex gap-2 items-end">
              <BotIcon className="size-5 text-indigo-500" />
              <span className="size-2 bg-gray-500 rounded-full animate-bounce" />
              <span className="size-2 bg-gray-500 rounded-full animate-bounce delay-150" />
              <span className="size-2 bg-gray-500 rounded-full animate-bounce delay-300" />
            </div>
          )}

          <div ref={messageRef} />
        </div>

        
        <form onSubmit={handleRevisions} className="m-3 relative">
          <textarea
            rows={4}
            placeholder="Describe your website or request changes..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating}
            className="w-full p-3 rounded-xl bg-gray-800 text-gray-100 resize-none"
          />

          <button
            disabled={isGenerating || !input.trim()}
            className="absolute bottom-3 right-3 rounded-full bg-indigo-600"
          >
            {isGenerating ? (
              <Loader2Icon className="size-7 p-1.5 animate-spin" />
            ) : (
              <SendIcon className="size-7 p-1.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Sidebar;

