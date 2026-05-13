import { authClient } from "@/lib/auth-client";
import { Loader2Icon } from "lucide-react";
import React, { useState } from "react";
import  {toast}  from 'sonner';
import  api from '../configs/axios'
import { useNavigate } from "react-router-dom";
 
const Home = () => {

  const  {data: session} = authClient.useSession()
  const navigate = useNavigate()

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmitHandler = async(e: React.FormEvent) => {
    e.preventDefault();

    try{
      if(!session?.user){
           return toast.error('Pleas  sign in to create a project ');
           
      } else if(!input.trim()){
         return toast.error('Please enter a message')
      }
       setLoading(true)
       const {data} = await api.post('/api/user/project', {initial_prompt: input})
       setLoading(false);
       navigate(`/projects/${data.projectId}`)
    } catch(error: any){
      setLoading(false);
        toast.error(error?.response?.data?.message ||  error.message)
        console.log(error);
    }
    
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4">

      <div className="flex items-center gap-2 border border-zinc-700 rounded-full px-3 py-1 text-xs mb-6">
        <span className="bg-indigo-600 px-2 py-0.5 rounded-full text-[10px]">
          NEW
        </span>
        <span className="text-zinc-300">Try 30 days free trial option</span>
      </div>

      <h1 className="text-center text-4xl md:text-6xl font-semibold leading-tight max-w-3xl">
        Turn thoughts into websites <br /> instantly, with AI.
      </h1>

      <p className="text-zinc-400 text-center mt-4 max-w-md">
        Create, customize and publish website faster than ever with our AI Site Builder.
      </p>

      <form
        onSubmit={onSubmitHandler}
        className="mt-10 w-full max-w-2xl border border-indigo-500 rounded-xl p-6 bg-zinc-900"
      >
        <div className="flex items-end gap-3 min-h-[96px]">
          <textarea
            onChange={e => setInput(e.target.value)}
            placeholder="Describe your presentation in details"
            required
            className="bg-transparent outline-none text-gray-300 resize-none w-full"
            rows={4}
          />

          <button
            type="submit"
            className="ml-auto px-5 py-2 text-sm whitespace-nowrap 
                       flex items-center gap-2 
                       bg-gradient-to-r from-[#CB52D4] to-indigo-600 rounded-md"
          >
            {loading ? (
              <>
                Creating <Loader2Icon className="w-4 h-4 animate-spin" />
              </>
            ) : (
              "Create with AI"
            )}
          </button>
        </div>
      </form>

      <div className="flex gap-10 mt-14 text-zinc-400 text-lg items-center">
        <span className="flex items-center gap-2 font-medium">◼ Framer</span>
        <span className="flex items-center gap-2 font-medium">✿ HUAWEI</span>
        <span className="font-serif italic text-xl">Instagram</span>
        <span className="flex items-center gap-2 font-medium">⊞ Microsoft</span>
        <span className="flex items-center gap-1 font-medium">Walmart ✶</span>
      </div>
    </section>
  );
};

export default Home;
