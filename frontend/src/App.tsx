import React, { useState } from 'react';
import { LandingPage } from './pages/LandingPage';
import { DryRunPage } from './pages/DryRunPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'landing' | 'dry-run'>('landing');
  const [task, setTask] = useState("");
  const [txCount, setTxCount] = useState(100);
  
  // Ensure this points to your Python backend
  const apiBaseUrl = "http://localhost:8000"; 

  if (currentPage === 'landing') {
    return (
      <LandingPage 
        apiBaseUrl={apiBaseUrl}
        onTransitionToDryRun={(selectedTask, count) => {
          setTask(selectedTask);
          setTxCount(count);
          setCurrentPage('dry-run');
        }} 
      />
    );
  }

  return (
    <DryRunPage 
      initialTask={task} 
      txCount={txCount} 
      apiBaseUrl={apiBaseUrl}
      onReset={() => setCurrentPage('landing')} 
    />
  );
}