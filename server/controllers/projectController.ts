
import { Request, Response } from 'express'
import prisma from '../lib/prisma.js'
import openai from '../configs/openai.js'

// ================= MAKE REVISION =================

export const makeRevision = async (req: Request, res: Response) => {
  const userId = req.userId

  try {
    const { projectId } = req.params
    const { message } = req.body

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'Please enter a valid prompt' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user || user.credits < 5) {
      return res.status(403).json({ message: 'Add more credits to make changes' })
    }

    const project = await prisma.websiteProject.findUnique({
      where: { id: projectId, userId },
      include: { versions: true }
    })

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    await prisma.conversation.create({
      data: {
        role: 'user',
        content: message,
        projectId
      }
    })

    await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: 5 } }
    })

    const enhance = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Enhance the user request into a clear and actionable website change request.'
        },
        { role: 'user', content: message }
      ]
    })

    const enhancedPrompt =
      enhance.choices[0].message.content || message

    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content: `I've enhanced your prompt to: "${enhancedPrompt}"`,
        projectId
      }
    })

    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content: 'Now making changes to your website...',
        projectId
      }
    })

    const gen = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert web developer. Return ONLY the complete updated HTML using Tailwind CSS. ' +
            'Maintain a high-quality, professional design with realistic imagery. ' +
            'FOR IMAGES: You MUST use unique HTTPS URLs from LoremFlickr for each image. ' +
            'FORMAT: https://loremflickr.com/800/600/<keyword>?random=<number>. ' +
            'Every image MUST have a different "random" number. ' +
            'DO NOT use Unsplash unless you have a confirmed valid ID. LoremFlickr is PREFERRED. ' +
            'Ensure the website remains responsive and interactive. DO NOT include any explanations, comments, or markdown.'
        },
        {
          role: 'user',
          content: `Current code: ${project.current_code}. Change request: ${enhancedPrompt}`
        }
      ]
    })

    const code = gen.choices[0].message.content
    console.log("--- REVISION CODE START ---");
    console.log(code);
    console.log("--- REVISION CODE END ---");

    if (!code) {
      await prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: 5  } }
      })
      return res.status(500).json({ message: 'Code generation failed' })
    }

    const version = await prisma.version.create({
      data: {
        code: code.replace(/```[a-z]*\n?/gi, '').replace(/```$/g, '').trim(),
        description: 'changes made',
        projectId
      }
    })

    await prisma.websiteProject.update({
      where: { id: projectId },
      data: {
        current_code: version.code,
        current_version_index: version.id
      }
    })

    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content: "I've updated your website. You can preview it now.",
        projectId
      }
    })

    res.json({ message: 'Changes made successfully' })
  } catch (error: any) {
    console.log(error.message)
    res.status(500).json({ message: error.message })
  }
}

// ================= ROLLBACK =================

export const rollbackToVersion = async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    const { projectId, versionId } = req.params

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const version = await prisma.version.findFirst({
      where: { id: versionId, projectId }
    })

    if (!version) {
      return res.status(404).json({ message: 'Version not found' })
    }

    await prisma.websiteProject.update({
      where: { id: projectId, userId },
      data: {
        current_code: version.code,
        current_version_index: version.id
      }
    })

    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content: 'Website rolled back to selected version.',
        projectId
      }
    })

    res.json({ message: 'Rollback successful' })
  } catch (error: any) {
    console.log(error.message)
    res.status(500).json({ message: error.message })
  }
}

// ================= PREVIEW CURRENT PROJECT =================

export const getProjectPreview = async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    const { projectId } = req.params

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const project = await prisma.websiteProject.findUnique({
      where: { id: projectId, userId }
    })

    if (!project || !project.current_code) {
      return res.status(404).json({ message: 'Project not found' })
    }

    res.json({ code: project.current_code })
  } catch (error: any) {
    console.log(error.message)
    res.status(500).json({ message: error.message })
  }
}

// ================= PREVIEW VERSION (NEW TAB) =================

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { projectId, versionId } = req.params

    if (versionId) {
      const version = await prisma.version.findFirst({
        where: { id: versionId, projectId }
      })

      if (!version) {
        return res.status(404).json({ message: 'Version not found' })
      }

      return res.json({ code: version.code })
    }

    const project = await prisma.websiteProject.findFirst({
      where: { id: projectId, isPublished: true }
    })

    if (!project || !project.current_code) {
      return res.status(404).json({ message: 'Project not found' })
    }

    res.json({ code: project.current_code })
  } catch (error: any) {
    console.log(error.message)
    res.status(500).json({ message: error.message })
  }
}

// ================= SAVE PROJECT =================

export const saveProjectCode = async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    const { projectId } = req.params
    const { code } = req.body

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    if (!code) {
      return res.status(400).json({ message: 'Code is required' })
    }

    const version = await prisma.version.create({
      data: {
        code,
        description: 'manual save',
        projectId
      }
    })

    await prisma.websiteProject.update({
      where: { id: projectId },
      data: {
        current_code: code,
        current_version_index: version.id
      }
    })

    res.json({ message: 'Project saved successfully' })
  } catch (error: any) {
    console.log(error.message)
    res.status(500).json({ message: error.message })
  }
}

// ================= DELETE =================

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    const { projectId } = req.params

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    await prisma.websiteProject.delete({
      where: { id: projectId, userId }
    })

    res.json({ message: 'Project deleted successfully' })
  } catch (error: any) {
    console.log(error.message)
    res.status(500).json({ message: error.message })
  }
}

// ================= PUBLISHED =================

export const getPublishedProjects = async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.websiteProject.findMany({
      where: { isPublished: true },
      include: { user: true }
    })

    res.json({ projects })
  } catch (error: any) {
    console.log(error.message)
    res.status(500).json({ message: error.message })
  }
}
