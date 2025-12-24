
import React, { useState, useCallback } from 'react';
import { Scene, StoryState, AppStatus } from './types';
import { generatePrompts, generateImage } from './services/geminiService';

const App: React.FC = () => {
  const [story, setStory] = useState('');
  const [sceneCount, setSceneCount] = useState(3);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [state, setState] = useState<StoryState>({
    originalStory: '',
    sceneCount: 0,
    scenes: [],
    thumbnailPrompt: ''
  });
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!story.trim()) return;
    
    setError(null);
    setStatus(AppStatus.GENERATING_PROMPTS);
    
    try {
      const result = await generatePrompts(story, sceneCount);
      
      const newScenes: Scene[] = result.scenes.map((s: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        sceneNumber: s.sceneNumber,
        prompt: s.prompt,
        isGenerating: false
      }));

      setState({
        originalStory: story,
        sceneCount: sceneCount,
        scenes: newScenes,
        thumbnailPrompt: result.thumbnailPrompt
      });
      
      setStatus(AppStatus.READY);
    } catch (err) {
      console.error(err);
      setError('Failed to generate prompts. Please check your API key and try again.');
      setStatus(AppStatus.ERROR);
    }
  };

  const handleAddScene = async () => {
    setError(null);
    setStatus(AppStatus.GENERATING_PROMPTS);
    
    try {
      const result = await generatePrompts(state.originalStory, 1, state.scenes);
      
      // The result might return multiple if the prompt logic decides, but we usually expect 1 more
      const nextNum = state.scenes.length + 1;
      const additionalScenes: Scene[] = result.scenes.map((s: any, idx: number) => ({
        id: Math.random().toString(36).substr(2, 9),
        sceneNumber: nextNum + idx,
        prompt: s.prompt,
        isGenerating: false
      }));

      setState(prev => ({
        ...prev,
        scenes: [...prev.scenes, ...additionalScenes]
      }));
      
      setStatus(AppStatus.READY);
    } catch (err) {
      console.error(err);
      setError('Failed to add scene.');
      setStatus(AppStatus.ERROR);
    }
  };

  const handleGenerateImages = async () => {
    setStatus(AppStatus.GENERATING_IMAGES);
    
    // Generate thumbnail first
    try {
      if (state.thumbnailPrompt && !state.thumbnailUrl) {
        const thumbUrl = await generateImage(state.thumbnailPrompt, "16:9");
        setState(prev => ({ ...prev, thumbnailUrl: thumbUrl }));
      }

      // Generate scene images sequentially to avoid overwhelming rate limits (if any)
      // but UI-wise we show them updating
      const updatedScenes = [...state.scenes];
      for (let i = 0; i < updatedScenes.length; i++) {
        if (!updatedScenes[i].imageUrl) {
          updatedScenes[i] = { ...updatedScenes[i], isGenerating: true };
          setState(prev => ({
            ...prev,
            scenes: updatedScenes.map((s, idx) => idx === i ? updatedScenes[i] : s)
          }));

          try {
            const url = await generateImage(updatedScenes[i].prompt, "16:9");
            updatedScenes[i] = { ...updatedScenes[i], imageUrl: url, isGenerating: false };
          } catch (e) {
            console.error(`Error generating image for scene ${i+1}`, e);
            updatedScenes[i] = { ...updatedScenes[i], isGenerating: false };
          }

          setState(prev => ({
            ...prev,
            scenes: [...updatedScenes]
          }));
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to generate some images.');
    } finally {
      setStatus(AppStatus.READY);
    }
  };

  const handleGenerateSingleImage = async (sceneId: string) => {
    const sceneIndex = state.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) return;

    const updatedScenes = [...state.scenes];
    updatedScenes[sceneIndex] = { ...updatedScenes[sceneIndex], isGenerating: true };
    setState(prev => ({ ...prev, scenes: updatedScenes }));

    try {
      const url = await generateImage(updatedScenes[sceneIndex].prompt, "16:9");
      updatedScenes[sceneIndex] = { ...updatedScenes[sceneIndex], imageUrl: url, isGenerating: false };
    } catch (err) {
      console.error(err);
      updatedScenes[sceneIndex] = { ...updatedScenes[sceneIndex], isGenerating: false };
    }

    setState(prev => ({ ...prev, scenes: updatedScenes }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold italic shadow-lg shadow-blue-500/20">S2M</div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Story-to-Media</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 font-medium px-2 py-1 bg-slate-800 rounded uppercase tracking-widest">AI Engine: Gemini 3</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        {/* Input Section */}
        <section className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-400 uppercase tracking-wider">The Story</label>
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Paste your story here (any language)..."
                className="w-full h-64 bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200 placeholder:text-slate-600 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all resize-none shadow-inner"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-400 uppercase tracking-wider block">Scenes</label>
                <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-1 rounded-lg">
                  {[2, 3, 5, 8].map(n => (
                    <button
                      key={n}
                      onClick={() => setSceneCount(n)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${sceneCount === n ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={sceneCount}
                    onChange={(e) => setSceneCount(parseInt(e.target.value) || 1)}
                    className="w-16 bg-transparent border-l border-slate-800 px-3 py-1 text-center text-sm font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 min-w-[200px] flex items-end">
                <button
                  onClick={handleGenerate}
                  disabled={status === AppStatus.GENERATING_PROMPTS || !story.trim()}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {status === AppStatus.GENERATING_PROMPTS ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Analyzing Narrative...
                    </>
                  ) : (
                    'Generate Cinematic Prompts'
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-serif text-xl italic text-slate-200">The S2M AI Process</h3>
            <ul className="space-y-4 text-sm text-slate-400">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold">1</span>
                <span>Our AI analyzes your story's emotional beats and key visual moments.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold">2</span>
                <span>It constructs high-detail cinematic image prompts in English.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold">3</span>
                <span>You can then render each scene using state-of-the-art vision models.</span>
              </li>
            </ul>
            {error && (
              <div className="p-3 bg-red-950/30 border border-red-900/50 text-red-400 text-xs rounded-lg mt-4">
                {error}
              </div>
            )}
          </div>
        </section>

        {/* Output Section */}
        {state.scenes.length > 0 && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-serif font-bold italic">Generated Storyboard</h2>
              <div className="flex gap-3">
                <button
                  onClick={handleGenerateImages}
                  disabled={status === AppStatus.GENERATING_IMAGES}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {status === AppStatus.GENERATING_IMAGES ? 'Rendering...' : 'Render All Media'}
                </button>
                <button
                  onClick={handleAddScene}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-medium rounded-lg transition-all"
                >
                  Add Scene
                </button>
              </div>
            </div>

            {/* Thumbnail Preview */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden group">
              <div className="grid md:grid-cols-2">
                <div className="p-8 flex flex-col justify-center space-y-4">
                  <div>
                    <span className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1 block">Master Thumbnail</span>
                    <h3 className="text-2xl font-serif italic text-white">Visual Narrative Summary</h3>
                  </div>
                  <p className="text-sm text-slate-400 italic">"{state.thumbnailPrompt}"</p>
                  {!state.thumbnailUrl && (
                    <button
                      onClick={() => handleGenerateImages()}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    >
                      Render Thumbnail →
                    </button>
                  )}
                </div>
                <div className="aspect-video bg-slate-950 relative overflow-hidden">
                  {state.thumbnailUrl ? (
                    <img src={state.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-800 font-serif italic text-4xl">S2M Preview</div>
                  )}
                </div>
              </div>
            </div>

            {/* Scenes Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              {state.scenes.map((scene) => (
                <div key={scene.id} className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700 transition-colors">
                  <div className="aspect-video bg-slate-950 relative">
                    {scene.imageUrl ? (
                      <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                        {scene.isGenerating ? (
                          <>
                            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Generating Visual...</span>
                          </>
                        ) : (
                          <>
                            <div className="text-slate-800 font-serif italic text-2xl">Scene {scene.sceneNumber}</div>
                            <button
                              onClick={() => handleGenerateSingleImage(scene.id)}
                              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-full transition-all border border-slate-700"
                            >
                              Render Scene
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/10">
                      SCENE {scene.sceneNumber}
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Image Prompt</label>
                      <p className="text-sm text-slate-300 leading-relaxed font-medium">
                        {scene.prompt}
                      </p>
                    </div>
                    <div className="flex justify-end pt-2">
                       <button
                         onClick={() => {
                           navigator.clipboard.writeText(scene.prompt);
                           // Simple temporary tooltip or state could be added here
                         }}
                         className="text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase"
                       >
                         Copy Prompt
                       </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {state.scenes.length === 0 && status === AppStatus.IDLE && (
          <div className="py-20 flex flex-col items-center text-center space-y-4 opacity-50">
             <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-3xl">🎬</div>
             <p className="font-serif italic text-slate-400">Waiting for a story to unfold...</p>
          </div>
        )}
      </main>

      {/* Floating Action Bar (Sticky Call-to-Action) */}
      {state.scenes.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-lg">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current Story</div>
              <div className="text-sm font-medium truncate max-w-[200px]">{state.originalStory.substring(0, 40)}...</div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setStory('');
                  setState({ originalStory: '', sceneCount: 0, scenes: [], thumbnailPrompt: '' });
                  setStatus(AppStatus.IDLE);
                }}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg transition-all"
              >
                Reset
              </button>
              <button
                onClick={handleGenerateImages}
                disabled={status === AppStatus.GENERATING_IMAGES}
                className="flex-[2] sm:flex-none px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-xs font-bold rounded-lg transition-all shadow-lg shadow-blue-500/20"
              >
                {status === AppStatus.GENERATING_IMAGES ? 'Rendering...' : 'Render Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
