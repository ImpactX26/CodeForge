import React, { useState } from 'react';
import { LandingPage } from './pages/LandingPage';
import { DryRunPage } from './pages/DryRunPage';

const API_BASE_URL = "http://127.0.0.1:4000";

export function App() {
  const [currentTask, setCurrentTask] = useState<string | null>(null);

  // If a task is set, render the dedicated Dry-Run execution page
  if (currentTask) {
    return (
      <DryRunPage 
        initialTask={currentTask} 
        apiBaseUrl={API_BASE_URL} 
        onReset={() => setCurrentTask(null)} 
      />
    );
  }

  // Otherwise, render Page 1 (Landing & Naive mode)
  return (
    <LandingPage 
      onTransitionToDryRun={(task) => setCurrentTask(task)} 
      apiBaseUrl={API_BASE_URL} 
    />
  );
}

export default App;