
import { GoogleGenAI, Type } from "@google/genai";
import { Scene } from "../types";

const PROMPT_GENERATOR_INSTRUCTIONS = `
You are a professional AI Prompt Generator for a web-based tool called "S2M AI – Story-to-Media Generator".

USER WILL PROVIDE:
- A story (any language)
- Desired number of scenes (user-entered number)
- Option to add more scenes if needed (indicated by existing scenes)

YOUR RESPONSIBILITIES:
1. Understand the story in its original language.
2. Do NOT rewrite, summarize, or modify the story.
3. Analyze the story structure and flow.
4. Generate image scenes intelligently based on the story.
5. If the user-entered scene count is low or high, adjust scene content smartly so the story still makes visual sense.
6. Generate EXACTLY the number of scenes requested.
7. If context of existing scenes is provided, continue generating NEW scenes from where they left off or expand the narrative logically.
8. Generate all IMAGE PROMPTS and the THUMBNAIL PROMPT in ENGLISH ONLY.
9. Keep output clean, professional, and copy-ready.
10. Do NOT include explanations, branding text, or extra commentary.

IMAGE PROMPT STYLE REQUIREMENTS:
- Cinematic composition
- Ultra-realistic visuals
- Lighting and shadow details
- Camera angle and depth of field
- Strong mood and emotion
- Story-accurate visuals
- 8K, high detail, professional photography

OUTPUT FORMAT:
You must return a JSON object containing an array of scenes (with text prompts) and one thumbnail prompt.
`;

export const generatePrompts = async (story: string, sceneCount: number, existingScenes: Scene[] = []) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `
    Story: ${story}
    Number of NEW scenes to generate: ${sceneCount}
    Already existing scenes: ${JSON.stringify(existingScenes.map(s => ({ number: s.sceneNumber, prompt: s.prompt })))}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: PROMPT_GENERATOR_INSTRUCTIONS,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sceneNumber: { type: Type.INTEGER },
                prompt: { type: Type.STRING }
              },
              required: ['sceneNumber', 'prompt']
            }
          },
          thumbnailPrompt: { type: Type.STRING }
        },
        required: ['scenes', 'thumbnailPrompt']
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "16:9" | "9:16" = "16:9") => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("No image generated in response");
};
