
export interface Scene {
  id: string;
  sceneNumber: number;
  prompt: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

export interface StoryState {
  originalStory: string;
  sceneCount: number;
  scenes: Scene[];
  thumbnailPrompt: string;
  thumbnailUrl?: string;
}

export enum AppStatus {
  IDLE = 'idle',
  GENERATING_PROMPTS = 'generating_prompts',
  GENERATING_IMAGES = 'generating_images',
  READY = 'ready',
  ERROR = 'error'
}
