import { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import openai from "../configs/openai.js";
import Stripe from 'stripe'


//    Get  User  Credits
export const getUserCredits = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    res.json({ credits: user?.credits });
  } catch (error: any) {
    console.log(error.code || error.message);
    res.status(500).json({ message: error.message });
  }
};

//   Controller Function to create New Project

export const createUserProject = async (req: Request, res: Response) => {
  const userId = req.userId;
  try {
    const { initial_prompt } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (user && user.credits < 5) {
      return res
        .status(403)
        .json({ message: "add crdits  to creates to create more projects" });
    }

    //   Create a new project
    const project = await prisma.websiteProject.create({
      data: {
        name:
          initial_prompt.length > 50
            ? initial_prompt.substring(0, 47) + "..."
            : initial_prompt,
        initial_prompt,
        userId,
      },
    });

    //  Update User's  Total Creation
    await prisma.user.update({
      where: { id: userId },
      data: { totalCreation: { increment: 1 } },
    });

    await prisma.conversation.create({
      data: {
        role: "user",
        content: initial_prompt,
        projectId: project.id,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: 5 } },
    });

    res.json({ projectId: project.id });

    //Enhance  user  prompt

    const promptEnhanceResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: ` You are prompt enhancement specialist.Take the user's  website request and expand  it into a detailed, comprehensive prompt that will help create the best possible website.
                        
                        Enhance the prompt by:
                        1. Adding specific design details (layout, color scheme, typography)
                        2. Specifying Key sections and features (e.g., hero, features, testimonials, gallery)
                        3. Describing the user experience and interactions
                        4. Including modern web design best practices
                        5. Mentioning responsive design requirements
                        6. THEMATIC IMAGERY: Identify the niche (e.g., Bakery, Gym, Law Firm) and specify extremely detailed keywords for images.
                        7. For ANY niche, recommend using: https://loremflickr.com/800/600/<niche_keyword>?random=<unique_number> for a stunning Hero image immediately below the navbar.
                        8. Adding any missing but important elements
                        
                        Return ONLY the enhanced prompt, nothing else. Make it detailed but concise (2-3 paragraphs max).`,
        },
        {
          role: "user",
          content: initial_prompt,
        },
      ],
    });

    const enhancedPrompt = promptEnhanceResponse.choices[0].message.content;

    await prisma.conversation.create({
      data: {
        role: "assistant",
        content: `I 've enhanced your prompt to: "${enhancedPrompt}'`,
        projectId: project.id,
      },
    });

    await prisma.conversation.create({
      data: {
        role: "assistant",
        content: `now generating your website...`,
        projectId: project.id,
      },
    });

    //  Generate wesite code
    const codeGenerationResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini", 
      max_tokens: 10000,
     
      messages: [
        {
          role: "system",
          content: `
          You are an expert web developer. Create a complete, production-ready, single-page website based on this request: "${enhancedPrompt}"

         CRITICAL REQUIREMENTS:
         - You MUST output valid HTML ONLY. 
        - Use Tailwind CSS for ALL styling
        - Include this EXACT script in the <head>: <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
        - Use Tailwind utility classes extensively for styling, animations, and responsiveness
        - Make it fully functional and interactive with JavaScript in <script> tag before closing </body>
        - Use modern, beautiful design with great UX using Tailwind classes
       - YOU ARE A WORLD-CLASS DESIGNER. The website MUST look like a premium, $10,000 professional site.
       - USE LUXURIOUS DESIGN: Glassmorphism, deep shadows, smooth gradients, and elegant typography (Inter/Roboto).
       - IMAGES ARE MANDATORY: Every section (Hero, Features, Menu, Gallery) MUST have beautiful, large images.
       - IMPORTANT: The Hero section MUST have a STUNNING background image with a dark overlay and white text, placed immediately below the navbar.
       - IMAGE SOURCE: You MUST use Unsplash-style images. Use this format: https://loremflickr.com/800/600/<specific_keyword>?random=<number>
       - REPLACE <specific_keyword> with something VERY relevant (e.g., "bakery", "fitness", "luxury-car").
       - TAILWIND STYLING: Use rounded-2xl, shadow-2xl, hover:scale-105, and backdrop-blur-md for a high-end feel.
       - NEVER return gray boxes or placeholders. Use real, colorful thematic images.
           
        CRITICAL HARD RULES:
        1. You MUST put ALL output ONLY into message.content.
        2. You MUST NOT place anything in "reasoning", "analysis", "reasoning_details", or any hidden fields.
        3. You MUST NOT include internal thoughts, explanations, analysis, comments, or markdown.
        4. Do NOT include markdown, explanations, notes, or code fences.

        The HTML should be complete and ready to render as-is with Tailwind CSS.`, 
        },
        {
            role: 'user',
            content:  enhancedPrompt  || ''
        }
      ]
    })

    const code =  codeGenerationResponse.choices[0].message.content  ||  '';
    console.log("--- GENERATED CODE START ---");
    console.log(code);
    console.log("--- GENERATED CODE END ---");

     if(!code){   
         await prisma.conversation.create({
        data: {
            role: 'assistant',
            content: "Unable to generate the code, please try again",
            projectId: project.id
        }
    })
          await prisma.user.update({
        where: {id: userId},
        data: {credits: {increment: 5}}
    })
      return;
    }

    //   Create Version for the project
    const  version = await prisma.version.create({
        data: {
            code: code.replace(/```[a-z]*\n?/gi, '')
            .replace(/```$/g, '')
            .trim(),
            description: 'Initial version',
            projectId: project.id
        }
    })

    await prisma.conversation.create({
        data: {
            role: 'assistant',
            content:  "I 've created your websitel! You can now preview it and request any changes.",
             projectId: project.id
        }
    })
    
    await prisma.websiteProject.update({
        where: {id: project.id},
        data: {
            current_code: code.replace(/```[a-z]*\n?/gi, '')
            .trim(),
            current_version_index: version.id
        }
    })

  } catch (error: any) {
    await prisma.user.update({
        where: {id: userId},
        data: {credits : {increment: 5}}
    })
    console.log(error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};



//    Controller Function to Get  A Single  User Project 

export const getUserProject= async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {projectId} = req.params;

    const project = await prisma.websiteProject.findUnique({
        where: {id: projectId, userId},
        include: {
            conversation: {
                orderBy : {timestamp: 'asc'}
            },
            versions: {orderBy: {timestamp: 'asc'}}
        }
    })

    
    res.json({project});

  } catch (error: any) {
    console.log(error.code || error.message);
    res.status(500).json({ message: error.message });
  }
};


//    Controller Function to Get All Users Projects


export const getUserProjects= async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

   

    const projects = await prisma.websiteProject.findMany({
        where: { userId},
        orderBy: {updatedAt: 'desc'} 
    })

    
    res.json({projects});

  } catch (error: any) {
    console.log(error.code || error.message);
    res.status(500).json({ message: error.message });
  }
};


//   Controller Function  to Toggle Project Publish

export const togglePublish = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
   
    const {projectId}  = req.params;

    const project = await prisma.websiteProject.findUnique({
        where: {id: projectId, userId}
    })

    if(!project){
        return res.status(404).json({message: 'Project not found'});
    }

    await prisma.websiteProject.update({
        where: {id: projectId, userId},
        data: {isPublished: !project.isPublished}
    })
  
    res.json({message: project.isPublished ? 'project Unpublished' : 'Project Published Successfully'});

  } catch (error: any) {
    console.log(error.code || error.message);
    res.status(500).json({ message: error.message });
  }
};

//   Controller Function to Purchase Credits

export const purchaseCredits = async (req: Request, res: Response) => {
     try{
       interface Plan {
            credits: number;
            amount:  number;
       }

       const  plans = {
        basics :  {credits: 100, amount: 50},
        pro: {credits: 400, amount: 190},
        enterprise: {credits: 1000, amount: 490},
       }

       const userId  = req.userId;
       const {planId} = req.body as {planId: keyof  typeof plans}
       const origin = req.headers.origin as  string;

       const plan: Plan  = plans[planId]

       if(!plan){
         return  res.status(404).json({message:  'Plan not found'});
       }

       const transaction =  await prisma.transaction.create({
          data :{
             userId: userId!,
             planId : req.body.planId,
             amount: plan.amount,
             credits: plan.credits
          }
       })
 
        const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY as string);
 
        const session = await stripe.checkout.sessions.create({
              success_url: `${origin}/loading`,
              cancel_url: `${origin}`,
               line_items: [
               {
              price_data: {
                currency: 'INR',
                product_data: {
                   name: `AiSiteBuilder  - ${plan.credits}  credits`
                },
                unit_amount: Math.floor(transaction.amount) * 100
              },
              quantity: 1  
               },
            ],
             mode: 'payment',
             metadata: {
              transactionId: transaction.id,
              appId: 'ai-site-builder'
             },
             expires_at: Math.floor(Date.now() / 1000) + 30 * 60, //  Expires in 30 minutes
        });
        
        res.json({payment_link: session.url})

     }catch (error: any){
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message});
     }
    
};