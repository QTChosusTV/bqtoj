// ide/page.tsx

'use client';

import { useAuth } from '@/context/AuthContext'
import { useState, useEffect, useRef } from 'react';
import { MonacoEditor } from '@/components/ide/monaco-editor';
import { ThemeSwitcher } from '@/components/ide/theme-switcher';
import { languageTemplates, getLanguageTemplate } from '@/lib/ide/language-templates';
import { supabase } from '@/utils/supabaseClient';
import Link from 'next/link';
import type { editor } from 'monaco-editor';
import type { User } from '@supabase/supabase-js';


export default function IDEPage() {
  const [selectedLanguage, setSelectedLanguage] = useState('cpp');
  const [code, setCode] = useState(languageTemplates[0].defaultCode);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(40);
  const [outputHeight, setOutputHeight] = useState(50);
  const [timeExec, setTimeExec] = useState(0);
  const [isResizing, setIsResizing] = useState<'horizontal' | 'vertical' | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const autoSaveInterval = useRef<NodeJS.Timeout | null>(null);
  const { username, loading } = useAuth()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const savedCode = localStorage.getItem('ide-code');
    const savedInput = localStorage.getItem('ide-input');
    const savedTheme = localStorage.getItem('editor-theme');
    const savedLanguage = localStorage.getItem('ide-language');

    if (savedCode) setCode(savedCode);
    if (savedInput) setInput(savedInput);
    if (savedTheme) setEditorTheme(savedTheme);
    if (savedLanguage && languageTemplates.find((l) => l.language === savedLanguage)) {
      setSelectedLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => {
    if (autoSaveInterval.current) clearInterval(autoSaveInterval.current);

    autoSaveInterval.current = setInterval(() => {
      if (code) localStorage.setItem('ide-code', code);
      if (input) localStorage.setItem('ide-input', input);
    }, 3000); 

    return () => {
      if (autoSaveInterval.current) clearInterval(autoSaveInterval.current);
    };
  }, [code, input]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing === 'horizontal') {
        const newWidth = Math.max(20, Math.min(80, (e.clientX / window.innerWidth) * 100));
        setRightPanelWidth(100 - newWidth);
      } else if (isResizing === 'vertical') {
        const container = document.getElementById('right-panel');
        if (container) {
          const rect = container.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const newHeight = Math.max(20, Math.min(80, (relativeY / rect.height) * 100));
          setOutputHeight(100 - newHeight);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizing === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleRunCode = async () => {
    if (!username) {
      setOutput('❌ Authentication Required\n\nYou must be signed in to run code.\n\nPlease sign in at /auth');
      return;
    }

    setIsRunning(true);
    setOutput('Compiling and running code...\n');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setOutput('❌ No valid session found. Please sign in again.');
        setIsRunning(false);
        return;
      }

      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          code,
          input,
          language: selectedLanguage,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setOutput(result.output || 'Program executed successfully with no output.');
        const rawTime = typeof result.time === 'number' ? result.time : 0;
        setTimeExec(Math.round(rawTime * 1000)); 
        // console.log(response);
        // console.log(result);
      } else {
        //console.log(response);
        //console.log(result);
        setOutput(`⚠️ ${result.error || 'Execution failed'}\n\n${result.message || 'Check language support (cpp, c, python, java)'}`);
      }
    } catch (error) {
      setOutput(
        `Error connecting to server\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveCode = () => {
    localStorage.setItem('ide-code', code);
    localStorage.setItem('ide-input', input);
    localStorage.setItem('ide-language', selectedLanguage);
    // console.log('Code saved to browser storage');
  };

  const handleLanguageChange = (language: string) => {
    const template = getLanguageTemplate(language);
    if (template) {
      setSelectedLanguage(language);
      setCode(template.defaultCode);
      localStorage.setItem('ide-language', language);
    }
  };

  const handleCopyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // console.log(`${type} copied to clipboard`);
    });
  };

  const handleClearCode = () => {
    if (window.confirm('Are you sure you want to clear all code? This cannot be undone.')) {
      setCode('');
      setInput('');
      setOutput('');
      localStorage.removeItem('ide-code');
      localStorage.removeItem('ide-input');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-100">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-gray-100">
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <select
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="px-3 py-1.5 bg-gray-700 text-gray-200 rounded-md text-sm border border-gray-600 focus:outline-none focus:border-purple-400"
                aria-label="Select programming language"
              >
                {languageTemplates.map((lang) => (
                  <option key={lang.language} value={lang.language}>
                    {lang.displayName}
                  </option>
                ))}
              </select>

              <ThemeSwitcher currentTheme={editorTheme} onThemeChange={setEditorTheme} />

              {user ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-md text-sm">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-gray-300">{user.email/*?.split('@')[0]*/}</span>
                </div>
              ) : (
                <Link href="/auth" className="text-sm text-purple-400 hover:underline"> prefetch={false}
                  Sign In
                </Link>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowShortcuts(!showShortcuts)}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-md transition-colors duration-200"
                title="Keyboard Shortcuts"
                aria-label="Show keyboard shortcuts"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
              </button>

              <button
                onClick={handleClearCode}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors duration-200"
                aria-label="Clear all code and input"
              >
                Clear All
              </button>

              <button
                onClick={handleRunCode}
                disabled={isRunning}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 flex items-center gap-2 ${
                  isRunning
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
                aria-label={isRunning ? 'Code is running' : 'Run code (Ctrl+Enter)'}
              >
                {isRunning ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Running...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Run (Ctrl+Enter)
                  </>
                )}
              </button>
            </div>
          </div>

          {showShortcuts && (
            <div className="mt-3 p-3 bg-gray-700 rounded-md text-sm">
              <h3 className="font-bold mb-2 text-purple-400">Keyboard Shortcuts</h3>
              <div className="grid grid-cols-2 gap-2 text-gray-300">
                <div>
                  <kbd className="px-2 py-1 bg-gray-800 rounded">Ctrl+Enter</kbd> Run Code
                </div>
                <div>
                  <kbd className="px-2 py-1 bg-gray-800 rounded">Ctrl+S</kbd> Save Code
                </div>
                <div>
                  <kbd className="px-2 py-1 bg-gray-800 rounded">Ctrl+Shift+C</kbd> Clear Output
                </div>
                <div>
                  <kbd className="px-2 py-1 bg-gray-800 rounded">Ctrl+/</kbd> Toggle Comment
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex h-[calc(100vh-64px)] relative">
          <div className="border-r border-gray-700" style={{ width: `${100 - rightPanelWidth}%` }}>
            <MonacoEditor
              value={code}
              onChange={setCode}
              language={getLanguageTemplate(selectedLanguage)?.monacoLanguage || 'cpp'}
              theme={editorTheme}
              height="100%"
              onMount={(editor) => {
                editorRef.current = editor;
                const model = editor.getModel();
                if (model) {
                  model.updateOptions({
                    tabSize: 4,
                    insertSpaces: true,
                  });
                }
                editor.updateOptions({
                  fontSize: 16, 
                });
                /*console.log('MODEL OPTIONS:', model?.getOptions());*/
                // console.log('tab x space:', model?.getOptions().tabSize);
                /*console.log('insertSpaces:', model?.getOptions().insertSpaces);*/
              }}
            />
          </div>

          <div
            className="w-1 bg-gray-700 hover:bg-purple-600 cursor-col-resize transition-colors"
            onMouseDown={() => setIsResizing('horizontal')}
            role="separator"
            aria-label="Resize editor panel"
          />

          <div id="right-panel" className="flex flex-col" style={{ width: `${rightPanelWidth}%` }}>
            <div
              className="border-b border-gray-700 overflow-hidden"
              style={{ height: `${100 - outputHeight}%` }}
            >
              <div className="bg-gray-800 px-3 py-2 border-b border-gray-700 flex justify-between items-center">
                <span className="text-sm font-medium">Input</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyToClipboard(input, 'Input')}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors duration-200"
                    title="Copy Input"
                    aria-label="Copy input to clipboard"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setInput('')}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors duration-200"
                    title="Clear Input"
                    aria-label="Clear input"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your input here..."
                className="w-full h-full p-3 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
                style={{ minHeight: '200px' }}
                aria-label="Input for code execution"
              />
            </div>

            <div
              className="h-1 bg-gray-700 hover:bg-purple-600 cursor-row-resize transition-colors"
              onMouseDown={() => setIsResizing('vertical')}
              role="separator"
              aria-label="Resize input/output panels"
            />

            <div className="overflow-hidden" style={{ height: `${outputHeight}%` }}>
              <div className="bg-gray-800 px-3 py-2 border-b border-gray-700 flex justify-between items-center">
                <span className="text-sm font-medium text-left">{"Output"}</span>
                <span className="text-sm font-medium text-right flex-1 mr-2">{"Time: " + timeExec + "ms  "}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyToClipboard(output, 'Output')}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors duration-200"
                    title="Copy Output"
                    aria-label="Copy output to clipboard"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setOutput('')}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors duration-200"
                    title="Clear Output"
                    aria-label="Clear output"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <textarea
                value={output}
                readOnly
                placeholder="Output will appear here..."
                className="w-full h-full p-3 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
                style={{ minHeight: '200px' }}
                aria-label="Output from code execution"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}